import readline from "readline/promises"

// Define the encryption algorithm details
const algorithm = {
    name: "RSA-OAEP",
    modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]),
    hash: "SHA-256",
};

let numEnrolled = 0

const encryptAndEncode = async (publicKeyEncoded: string, number: number): Promise<string> => {
    const publicKeyDecoded = await crypto.subtle.importKey("jwk", JSON.parse(atob(publicKeyEncoded)), algorithm, true, ["encrypt"])
    const writeBuffer = Buffer.alloc(4)
    writeBuffer.writeInt32BE(number)
    const encryptedMessage = await crypto.subtle.encrypt(algorithm, publicKeyDecoded, writeBuffer);
    return Buffer.from(encryptedMessage).toString("base64")
}

const decryptAfterDecode = async ({ privateKey }: CryptoKeyPair, encodedAndEncrypted: string) => {
    const decodedMessage = Buffer.from(encodedAndEncrypted, "base64")
    const decryptedMessage = await crypto.subtle.decrypt(algorithm, privateKey, decodedMessage);
    return Buffer.from(decryptedMessage).readInt32BE()
}

const encodePublicKey = async ({ publicKey }: CryptoKeyPair) => {
    return btoa(JSON.stringify(await crypto.subtle.exportKey("jwk", publicKey)))
}

const client_enroll = async (keyPair: CryptoKeyPair) => {
    const publicKeyEncoded = await encodePublicKey(keyPair)

    console.log("Client identified by public key:", `...${publicKeyEncoded.substring(530)}`)

    // 1. Enroll
    const response = await fetch("http://localhost:4000/api/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            public_key: publicKeyEncoded,
        })
    })
    console.log("Requested to enroll with status:", response.status)
    if (response.status === 200) {
        numEnrolled++
    }
}

type Client = { keyPair: CryptoKeyPair, privateNumber: number, privateRisidual?: number }

const getPartners = async (client: Client) => {

    const { keyPair, privateNumber } = client

    const publicKeyEncoded = await encodePublicKey(keyPair)
    // 1. Get my partners
    const partnersRequest = await fetch(`http://localhost:4000/api/partners/${publicKeyEncoded}`);
    console.log("partnersRequest", partnersRequest.status)

    const res: { partners: string[] } = (await partnersRequest.json())

    // 2. Split my number into #partners + 1 pieces
    let sumOfShares = 0

    console.log("Sum of partners", res.partners.length)
    const shares = await Promise.all(res.partners.map(async partner_public_key => {
        const shareNumber = Math.floor(Math.random() * 1000) + 1
        sumOfShares += shareNumber
        const encrypted_share = await encryptAndEncode(partner_public_key, shareNumber)

        return {
            public_key: partner_public_key,
            encrypted_share
        }
    }))
    const privateRisidual = privateNumber - sumOfShares

    // 3. Send back the pieces for each partner
    const submitSharesRequest = await fetch(`http://localhost:4000/api/submit_partners_shares/${publicKeyEncoded}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            shares,
        })
    });
    console.log("submitSharesRequest", submitSharesRequest.status)

    return {
        ...client,
        privateRisidual
    }
}

const makePartialSum = async ({ keyPair, privateRisidual }: Client) => {
    const publicKeyEncoded = await encodePublicKey(keyPair)

    // 4. Get my pieces
    const mySharesRequest = await fetch(`http://localhost:4000/api/shares/${publicKeyEncoded}`);
    console.log("mySharesRequest", mySharesRequest.status)

    // 5. Decrypt all my pieces and sum them
    const myShares: { shares: string[] } = await mySharesRequest.json()

    if (privateRisidual === undefined) {
        throw new Error("Private risidual not set")
    }

    let partialSum = privateRisidual
    await Promise.all(myShares.shares.map(async encryptedShare => {
        try {
            const decryptedShare = await decryptAfterDecode(keyPair, encryptedShare)
            console.log("decrypted", decryptedShare, privateRisidual)

            partialSum += decryptedShare
        } catch (e) {
            console.error("A decryption error happened", e)
        }
    }))

    // 6. Send the partial sum to the server
    const submitPartialSumRequest = await fetch(`http://localhost:4000/api/submit_partial_sum/${publicKeyEncoded}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            value: partialSum,
        })
    });
    console.log("submitPartialSumRequest", submitPartialSumRequest.status)
}

// Test
const keyPair = await crypto.subtle.generateKey(algorithm, true, ["encrypt", "decrypt"]);
const { publicKey } = keyPair
const publicKeyEncoded = btoa(JSON.stringify(await crypto.subtle.exportKey("jwk", publicKey)))

console.log("Test passing", await decryptAfterDecode(keyPair, await encryptAndEncode(publicKeyEncoded, 42)) === 42)

const numClients = 7

let clients = await Promise.all([...new Array(numClients)].map(async () => {
    const keyPair = await crypto.subtle.generateKey(algorithm, true, ["encrypt", "decrypt"]);

    return {
        privateNumber: 10,
        keyPair,
    }
}))

// Enroll all clients
await Promise.all(clients.map(({ keyPair }) => client_enroll(keyPair)))

console.log("Number Enrolled: ", numEnrolled)
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
})

await rl.question("Press enter to continue...")

// Exchange partners and send public shares
clients = await Promise.all(clients.map(getPartners))

await rl.question("Press enter to continue...")

// Retrieve client shares and calculates partial sum
await Promise.all(clients.map(makePartialSum))

rl.close()
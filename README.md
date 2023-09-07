# Private sum

A minimal proof of concept of a private sum protocol thta utilizes client
clustering and configurable number of client shares.

## How to run

1. Start the server `iex -S mix phx.server` in a server terminal
2. Start the clients `bun run index.ts` in a clients terminal
3. Finish enrollment by running `PrivateSum.PrivateSum.end_enrollment()` in the server terminal
4. Press enter to make the clients request partners
5. Press enter to make the clients exchange shares
6. Read the `SUM` in the server terminal

## The Protocol

The system can be in one of three states:

1. Enrollment
2. Exchange
3. Finished

In the enrollment state participants can enroll into the protocol. On the edge
to the exchange state, all participants are being devided into clusters.

In the exchange phase, participants exchange there share-parts. When they have
received all there share parts, they are sending their partial sums to the
server.

When all participants have send their partial sums to the server, the server
moves to finished mode and the sum can be read.

The states are controlled from the REPL for ease.

## Running the Experiment


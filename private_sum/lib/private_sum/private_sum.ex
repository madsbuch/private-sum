defmodule PrivateSum.PrivateSum do
  use GenServer

  def num_sharees(), do: 2
  def cluster_size(), do: 3

  def start_link(_opts \\ []) do
    GenServer.start_link(__MODULE__, %{
      sum: 0,
      state: :enroll, # :exchanging, :done
      clusters: [],
      shares: %{},
      participants: MapSet.new()
    }, name: __MODULE__)
  end

  def end_enrollment() do
    GenServer.call(__MODULE__, :end_enrollmens)
  end

  def enroll(public_key) do
    GenServer.call(__MODULE__, {:enroll, public_key})
  end

  def get_partners_for(public_key) do
    GenServer.call(__MODULE__, {:get_partners_for, public_key})
  end

  def store_share(share) do
    GenServer.call(__MODULE__, {:store_share, share})
  end

  def get_shares_for(public_key) do
    GenServer.call(__MODULE__, {:get_shares_for, public_key})
  end

  def submit_value(value) do
    GenServer.call(__MODULE__, {:submit_value, value})
  end

  # Server Callbacks

  def init(initial_state) do
    {:ok, initial_state}
  end

  def split_and_merge(list, chunk_size) when chunk_size > 1 do
    chunks = Enum.chunk_every(list, chunk_size)

    if length(List.last(chunks)) < chunk_size and length(chunks) > 1 do
      last_chunk = List.last(chunks)
      second_last_chunk = Enum.at(chunks, -2)
      merged_chunk = second_last_chunk ++ last_chunk

      List.delete_at(chunks, -1)
      |> List.delete_at(-1)
      |> List.insert_at(-1, merged_chunk)
    else
      chunks
    end
  end

  # PrivateSum.PrivateSum.end_enrollment()
  def handle_call(:end_enrollmens, _from, state) do


    # Divide all clients in clusters
    clusters = MapSet.to_list(state.participants)
    |> split_and_merge(cluster_size())

    new_state = state|> Map.put(:clusters, clusters) |> Map.put(:state, :exchanging)


    {:reply, :ok, new_state}
  end

  def handle_call({:enroll, public_key}, _from, state) do
    updated_state = Map.update!(state, :participants, fn participants -> MapSet.put(participants, public_key)
    end)

    {:reply, :ok, updated_state}
  end

  def handle_call({:get_partners_for, public_key}, _from, state) do
    cluster = state.clusters |> Enum.find(fn c -> Enum.find(c, fn x -> x == public_key end) end)
    index = Enum.find_index(cluster, fn x -> x == public_key end)
    friend = Enum.slice(cluster ++ cluster, rem(index + 1, length(cluster)), num_sharees())
    {:reply, friend, state}
  end

  def handle_call({:store_share, %{"public_key" => public_key, "encrypted_share" => encrypted_share}}, _from, state) do
    new_shares = Map.update(state.shares, public_key, [encrypted_share], fn ss -> [encrypted_share | ss] end)
    new_state = Map.put(state, :shares, new_shares)

    {:reply, :ok, new_state}
  end

  def handle_call({:get_shares_for, public_key}, _from, state) do
    shares = Map.get(state.shares, public_key, [])
    {:reply, shares, state}
  end

  def handle_call({:submit_value, value}, _from, state) do
    state = Map.update!(state, :sum, fn s -> s + value end)
    IO.inspect(state.sum, label: "SUM")
    {:reply, :ok, state}
  end
end

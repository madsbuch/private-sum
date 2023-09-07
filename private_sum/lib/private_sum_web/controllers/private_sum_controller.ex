defmodule PrivateSumWeb.PrivateSumController do
  use PrivateSumWeb, :controller

  def enroll(conn, %{"public_key" => public_key}) when is_binary(public_key) do
    PrivateSum.PrivateSum.enroll(public_key)
    send_resp(conn, :ok, "Public key enrolled successfully")
  end

  def get_partners(conn, %{"public_key" => public_key}) do
    partners = PrivateSum.PrivateSum.get_partners_for(public_key)
    send_resp(conn, :ok, Jason.encode!(%{public_key: public_key, partners: partners}))
  end

  def submit_partners_shares(conn, %{"shares" => shares, "public_key" => _public_key}) when is_list(shares) do
    # In real world scenario, this would need signing
    Enum.each(shares, fn share ->  PrivateSum.PrivateSum.store_share(share) end)
    send_resp(conn, :ok, "Shares stored successfully")
  end

  def get_partner_shares(conn, %{"public_key" => public_key}) do
    shares = PrivateSum.PrivateSum.get_shares_for(public_key)
    send_resp(conn, :ok, Jason.encode!(%{public_key: public_key, shares: shares}))
  end

  def submit_partial_sum(conn, %{"public_key" => _public_key, "value" => value}) when is_integer(value) do
    PrivateSum.PrivateSum.submit_value(value)
    send_resp(conn, :ok, "Value submitted successfully")
  end
end

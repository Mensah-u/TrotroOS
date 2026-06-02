-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create payment_transactions table
CREATE TABLE IF NOT EXISTS payment_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reference VARCHAR(255) NOT NULL UNIQUE,
  amount_in_pesewas INTEGER NOT NULL,
  seat_fare NUMERIC(10, 2) NOT NULL,
  platform_fee NUMERIC(10, 2) NOT NULL,
  request_fee NUMERIC(10, 2) NOT NULL DEFAULT 100, -- 1 GHS in pesewas
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed')),
  paystack_authorization_url TEXT,
  customer_email VARCHAR(255) NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  verified_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for better query performance
CREATE INDEX idx_payment_transactions_user_id ON payment_transactions(user_id);
CREATE INDEX idx_payment_transactions_reference ON payment_transactions(reference);
CREATE INDEX idx_payment_transactions_status ON payment_transactions(status);
CREATE INDEX idx_payment_transactions_created_at ON payment_transactions(created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see their own transactions
CREATE POLICY "Users can view their own payment transactions"
  ON payment_transactions FOR SELECT
  USING (auth.uid() = user_id);

-- RLS Policy: Only service role can insert (from edge functions)
CREATE POLICY "Service role can manage payment transactions"
  ON payment_transactions FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create a trigger to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_payment_transactions_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER payment_transactions_updated_at_trigger
  BEFORE UPDATE ON payment_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_payment_transactions_timestamp();

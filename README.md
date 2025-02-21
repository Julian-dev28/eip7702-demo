# EIP-7702 Account Upgrade Tutorial

Turn your regular Ethereum account into a smart account - keeping the same address! This tutorial demonstrates upgrading an EOA (Externally Owned Account) to a smart account using EIP-7702.

## Quick Start

1. Install dependencies:

```bash
npm install @zerodev/sdk @zerodev/ecdsa-validator viem
```

2. Set up your environment:

```bash
cp .env.example .env
```

Add to `.env`:
```env
PROJECT_ID=           # Get from zerodev.app
BUNDLER_RPC=         # Format: https://rpc.zerodev.app/api/v2/bundler/[PROJECT_ID]
PAYMASTER_RPC=       # Format: https://rpc.zerodev.app/api/v2/paymaster/[PROJECT_ID]
PRIVATE_KEY=          # Private key of your EOA
```

## Project Structure

```
├── scripts/
│   ├── make-key.ts       # Generate new EOA
│   ├── build-4337.ts     # Traditional AA demo
│   ├── build-7702.ts     # Upgrade EOA
│   └── index.ts          # Complete flow
├── .env.example
├── .env
├── package.json
└── README.md
```

## Running the Tutorial

The upgrade process is split into three steps:

### Step 1: Generate a Key
```bash
npx ts-node scripts/make-key.ts
```
This creates a new EOA and saves its private key to `.env`

### Step 2: Create ERC-4337 Account (Optional)
```bash
npx ts-node scripts/build-4337.ts
```
Shows how traditional account abstraction works (creates new address)

### Step 3: Upgrade to Smart Account
```bash
npx ts-node scripts/build-7702.ts
```
Upgrades your EOA to a smart account while keeping the same address!

## What's Actually Happening?

1. **Key Generation** (`make-key.ts`)
   - Creates new EOA (regular wallet)
   - Saves private key for next steps
   ```typescript
   const privateKey = generatePrivateKey()
   const signer = privateKeyToAccount(privateKey)
   ```

2. **ERC-4337 Demo** (`build-4337.ts`)
   - Shows traditional smart accounts
   - Creates new address (old way)
   ```typescript
   const account = await createKernelAccount(publicClient, {
     plugins: { sudo: ecdsaValidator },
     entryPoint: getEntryPoint("0.7"),
     kernelVersion: KERNEL_V3_3_BETA
   })
   ```

3. **EIP-7702 Upgrade** (`build-7702.ts`)
   - Takes your EOA
   - Upgrades it to smart account
   - Keeps same address! 🎉
   ```typescript
   const account = await createKernelAccount(publicClient, {
     address: signer.address,     // Keep same address
     eip7702Auth: authorization,  // Enable upgrade
     plugins: { sudo: ecdsaValidator }
   })
   ```

## Features You Get

After upgrading, your account can:
- Send multiple transactions at once
- Let others pay for gas (sponsored transactions)
- Use smart contract features
- Keep your original address

Example batch transaction:
```typescript
const userOpHash = await kernelClient.sendUserOperation({
  callData: await kernelClient.account.encodeCalls([
    { to: address1, value: amount1, data: data1 },
    { to: address2, value: amount2, data: data2 }
  ])
})
```



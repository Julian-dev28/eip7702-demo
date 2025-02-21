import "dotenv/config";
import { 
  createKernelAccount, 
  createKernelAccountClient, 
  createZeroDevPaymasterClient, 
  getUserOperationGasPrice 
} from "@zerodev/sdk";
import { 
  KERNEL_V3_3_BETA, 
  getEntryPoint 
} from "@zerodev/sdk/constants";
import { signerToEcdsaValidator } from "@zerodev/ecdsa-validator";
import { 
  http, 
  createPublicClient, 
  zeroAddress 
} from "viem";
import { 
  generatePrivateKey, 
  privateKeyToAccount 
} from "viem/accounts";
import { odysseyTestnet } from "viem/chains";
import fs from 'fs';

/**
 * This file (test-step-1.ts) handles the initial setup and deployment of an ERC-4337 account.
 * ERC-4337 is the Account Abstraction standard that allows for smart contract wallets.
 * 
 * The process:
 * 1. Create a new EOA (Externally Owned Account)
 * 2. Deploy a new smart account (different address from EOA)
 * 3. Set up the infrastructure for this account to operate
 */

const main = async () => {
    // STEP 1: Create a new EOA (regular crypto wallet) and save its private key
    // This EOA will later be upgraded to a smart account in test-step-2.ts
    const privateKey = generatePrivateKey()
    const signer = privateKeyToAccount(privateKey)
    
    // Save the private key to .env for use in step 2
    const envContent = fs.readFileSync('.env', 'utf8');
    const updatedContent = envContent.replace(/^PRIVATE_KEY=.*/gm, `PRIVATE_KEY=${privateKey}`);
    fs.writeFileSync('.env', updatedContent);
    
    console.log("Generated private key:", privateKey)
    console.log("Private key has been saved to .env file")
    console.log("Signer address:", signer.address)
    
    // STEP 2: Set up the blockchain client
    // The bundler is a service that handles submitting transactions for smart accounts
    const publicClient = createPublicClient({
      transport: http(process.env.BUNDLER_RPC),
      chain: odysseyTestnet
    })
  
    // STEP 3: Create a validator for the account
    // The validator determines who can control this account
    // Here we're using ECDSA (standard crypto signatures) for validation
    const ecdsaValidator = await signerToEcdsaValidator(publicClient, {
      signer,
      entryPoint: getEntryPoint("0.7"),
      kernelVersion: KERNEL_V3_3_BETA
    })
  
    // STEP 4: Deploy the actual smart account
    // This creates a NEW account with a different address from the EOA
    // In step 2, we'll upgrade the original EOA instead of using this new address
    const account = await createKernelAccount(publicClient, {
      plugins: {
        sudo: ecdsaValidator,
      },
      entryPoint: getEntryPoint("0.7"),
      kernelVersion: KERNEL_V3_3_BETA
    })
  
    // STEP 5: Set up gas sponsorship
    // This allows another account to pay for gas fees (optional)
    const zerodevPaymaster = createZeroDevPaymasterClient({
      chain: odysseyTestnet,
      transport: http(process.env.PAYMASTER_RPC),
    })
  
    // STEP 6: Create the client that will be used to operate the account
    const kernelClient = createKernelAccountClient({
      account,
      chain: odysseyTestnet,
      bundlerTransport: http(process.env.BUNDLER_RPC),
      client: publicClient,
      paymaster: {
        getPaymasterData(userOperation) {
          return zerodevPaymaster.sponsorUserOperation({userOperation})
        }
      },
      userOperation: {
        estimateFeesPerGas: async ({bundlerClient}) => {
          return getUserOperationGasPrice(bundlerClient)
        }
      }
    })
  
    // STEP 7: Send a test transaction to verify everything works
    const userOpHash = await kernelClient.sendUserOperation({
      callData: await kernelClient.account.encodeCalls([{
        to: zeroAddress,
        value: BigInt(0),
        data: "0x",
      }]),
    })
  
    // Wait for and log the result
    const receipt = await kernelClient.waitForUserOperationReceipt({
      hash: userOpHash,
      timeout: 1000 * 15,
    })
  
    console.log("Created ERC-4337 account:", kernelClient.account.address)
    console.log("ERC-4337 deployment complete!")
    console.log("View transaction:", `${odysseyTestnet.blockExplorers.default.url}/tx/${receipt.receipt.transactionHash}`)
  }

main().catch(console.error)
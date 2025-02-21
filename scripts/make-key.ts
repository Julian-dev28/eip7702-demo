import { 
  generatePrivateKey, 
  privateKeyToAccount 
} from "viem/accounts";
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
}

main().catch(console.error) 
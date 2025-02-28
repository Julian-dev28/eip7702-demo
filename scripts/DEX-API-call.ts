import "dotenv/config";
import {
    createPublicClient,
    createWalletClient,
    Hex,
    http,
    zeroAddress,
} from "viem";
import { odysseyTestnet } from "viem/chains";
import { eip7702Actions } from "viem/experimental";
import {
    getEntryPoint,
    KERNEL_V3_3_BETA,
    KernelVersionToAddressesMap,
} from "@zerodev/sdk/constants";
import { createKernelAccountClient } from "@zerodev/sdk";
import { getUserOperationGasPrice } from "@zerodev/sdk/actions";
import { createKernelAccount } from "@zerodev/sdk/accounts";
import { signerToEcdsaValidator } from "@zerodev/ecdsa-validator";
import { createZeroDevPaymasterClient } from "@zerodev/sdk";
import { privateKeyToAccount } from "viem/accounts";
import { client } from './DexClient';

interface TokenInfo {
  address: string;
  symbol: string;
  decimals: number;
}

interface DexRouter {
  name: string;
  routerAddress: string;
}

interface ComparisonQuote {
  dexName: string;
  toTokenAmount: string;
}

interface RouterResult {
  chainId: string;
  dexRouterList: DexRouter[];
  estimateGasFee: string;
  fromToken: TokenInfo;
  toToken: TokenInfo;
  fromTokenAmount: string;
  toTokenAmount: string;
  priceImpactPercentage: string;
  quoteCompareList: ComparisonQuote[];
  tradeFee: string;
}

interface TransactionData {
  to: string;
  data: string;
  value: string;
}

interface SwapResponseData {
  routerResult: RouterResult;
  tx?: TransactionData;
}

/**
 * EIP-7702 allows upgrading an existing EOA (regular wallet) into a smart account
 * while KEEPING THE SAME ADDRESS. This is different from test-step-1.ts which
 * created a new smart account at a new address.
 * 
 * The process:
 * 1. Take an EOA
 * 2. Sign an authorization to upgrade it
 * 3. Deploy the smart account code to the same address
 * 4. Verify the upgrade by performing a smart account operation
 */

// Use the private key saved from the ERC-4337 deployment
const PRIVATE_KEY = process.env.PRIVATE_KEY!;

const main = async () => {
    // STEP 1: Load the EOA we want to upgrade
    // This is the same EOA we created in test-step-1.ts
    const signer = privateKeyToAccount(PRIVATE_KEY as Hex)
    console.log("Upgrading EOA:", signer.address)

    // STEP 2: Create a wallet client with EIP-7702 capabilities
    // This special client can perform the upgrade process
    const walletClient = createWalletClient({
        account: signer,
        chain: odysseyTestnet,
        transport: http(),
    }).extend(eip7702Actions())

    // STEP 3: Sign the upgrade authorization
    // This is the key step that allows the EOA to be upgraded
    // It proves that the EOA owner consents to the upgrade
    const authorization = await walletClient.signAuthorization({
        contractAddress:
            KernelVersionToAddressesMap[KERNEL_V3_3_BETA].accountImplementationAddress,
        delegate: true,
    })

    // STEP 4: Setup Infrastructure
    const publicClient = createPublicClient({
        transport: http(process.env.BUNDLER_RPC),
        chain: odysseyTestnet,
    })

    // STEP 5: Create Validator
    // COMPLEX AUTHORIZATION:
    // ECDSA Validator provides sophisticated access control
    const ecdsaValidator = await signerToEcdsaValidator(publicClient, {
        signer,              // Defines the primary account
        entryPoint: getEntryPoint("0.7"),  // Specifies interaction point
        kernelVersion: KERNEL_V3_3_BETA,  // Specific implementation version
    })


    // STEP 6: Perform the actual upgrade
    // Note how we specify the same address as the EOA
    // and provide the authorization from step 3
    const account = await createKernelAccount(publicClient, {
        plugins: {
            sudo: ecdsaValidator,  // ROOT-LEVEL PERMISSIONS
            // Potential for role-based, time-locked, multi-sig configurations
        },
        entryPoint: getEntryPoint("0.7"),
        kernelVersion: KERNEL_V3_3_BETA,
        // PROGRAMMABLE SECURITY FEATURES
        eip7702Auth: authorization,  // Controlled upgrade path
        address: signer.address,     // Maintains original address
    })

    // GASLESS TRANSACTIONS:
    // Paymaster client allows someone else to cover gas fees
    // Removes blockchain interaction barriers for new users
    const paymasterClient = createZeroDevPaymasterClient({
        chain: odysseyTestnet,
        transport: http(process.env.PAYMASTER_RPC), // External service covers transaction costs
    })

    // STEP 8: Create Operational Client
    const kernelClient = createKernelAccountClient({
        account,
        chain: odysseyTestnet,
        bundlerTransport: http(process.env.BUNDLER_RPC),
        paymaster: paymasterClient,  // Enables gas sponsorship
        client: publicClient,
        userOperation: {
            estimateFeesPerGas: async ({ bundlerClient }) => {
                return getUserOperationGasPrice(bundlerClient)
            },
        },
    })

    async function geTX() {
        try {
          const swapData = await client.dex.getSwapData({
            chainId: '196', // Solana chain ID
            fromTokenAddress: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
            toTokenAddress: '0x1e4a5963abfd975d8c9021ce480b42188849d41d',
            amount: String(10 * 10 ** 16), // 0.1 ETH (in wei)
            slippage: '0.1',     // 0.1%
            userWalletAddress: '0xc17bfc89fe7c61d9417b5bffe087413d40ad8045'
          });
      
          console.log('Quote received:');
          console.log(JSON.stringify(swapData, null, 2));
          
          return swapData.data[0].tx;
        } catch (error) {
          if (error instanceof Error) {
            console.error('Error getting quote:', error.message);
            // API errors include details in the message
            if (error.message.includes('API Error:')) {
              const match = error.message.match(/API Error: (.*)/);
              if (match) console.error('API Error Details:', match[1]);
            }
          }
          throw error;
        }
      }

    // BATCHED TRANSACTIONS: 
    // Demonstrates ability to send multiple transactions in a single operation
    // Reduces gas costs and complexity by batching calls
    const swapData = await geTX();
    const userOpHash = await kernelClient.sendUserOperation({
        callData: await kernelClient.account.encodeCalls([
            {
                to: zeroAddress,
                value: BigInt(0),
                data: "0x",
            },
            {
                to: zeroAddress,  // Another destination in same transaction
                value: BigInt(0),
                data: "0x",
            },
        ]),
    })

    const { receipt } = await kernelClient.waitForUserOperationReceipt({
        hash: userOpHash,
    })

    console.log("EIP-7702 Upgrade complete!")
    console.log(
        "View transaction:",
        `${odysseyTestnet.blockExplorers.default.url}/tx/${receipt.transactionHash}`
    )
}

main().catch(console.error)
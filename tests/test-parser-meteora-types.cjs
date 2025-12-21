const fs = require('fs');
const path = require('path');

const METEORA_PROGRAM_ID = 'LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo';

const DISCRIMINATORS = {
    ADD_LIQUIDITY: '4Co7us6MBHJN',
    REMOVE_LIQUIDITY: '7FKxUv3oxZYZ',
    SWAP: 'fx9RHbGFfZ8h'
};

function identifyMeteoraTransaction(transaction) {
    if (!transaction.instructions) {
        return 'UNKNOWN_NO_INSTRUCTIONS';
    }

    for (const ix of transaction.instructions) {
        if (ix.programId === METEORA_PROGRAM_ID) {
            if (ix.data.startsWith(DISCRIMINATORS.ADD_LIQUIDITY)) {
                return 'ADD_LIQUIDITY';
            }
            if (ix.data.startsWith(DISCRIMINATORS.REMOVE_LIQUIDITY)) {
                return 'REMOVE_LIQUIDITY';
            }
            if (ix.data.startsWith(DISCRIMINATORS.SWAP)) {
                return 'SWAP';
            }
        }
    }

    return 'UNKNOWN_METEORA_TYPE';
}

const FILES = [
    'meteora-swap.json',
    'meteora-add-liquidity.json',
    'meteora-remove-liquidity.json'
];

console.log('Analyzing Meteora Transactions...\n');

FILES.forEach(filename => {
    const filePath = path.join(__dirname, filename);
    if (fs.existsSync(filePath)) {
        const tx = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const type = identifyMeteoraTransaction(tx);
        console.log(`File: ${filename}`);
        console.log(`Signature: ${tx.signature}`);
        console.log(`Identified Type: ${type}`);
        console.log('----------------------------------------');
    } else {
        console.log(`File not found: ${filename}`);
    }
});

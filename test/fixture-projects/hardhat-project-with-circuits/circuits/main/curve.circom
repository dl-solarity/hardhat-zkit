pragma circom  2.1.6;

template RegisterIdentityBuilder (
    SIGNATURE_TYPE,                 // 1, 2..  (list above) ^^^
    DG_HASH_TYPE,                   // 160, 224, 256, 384, 512 (list above)^^^
    DOCUMENT_TYPE,                  // 1: TD1; 3: TD3
    EC_BLOCK_NUMBER,
    EC_SHIFT,
    DG1_SHIFT,
    AA_SIGNATURE_ALGO,
    DG15_SHIFT,
    DG15_BLOCK_NUMBER,
    AA_SHIFT
) {

    var TREE_DEPTH = 80;
    var CHUNK_SIZE = 64;
    var CHUNK_NUMBER = 32;
    var HASH_TYPE = 256;

    if (SIGNATURE_TYPE == 2){
        CHUNK_NUMBER = 64;
    }

    if (SIGNATURE_TYPE == 13){
        HASH_TYPE = 384;
    }

    if (SIGNATURE_TYPE >= 20){
        CHUNK_NUMBER = 4;
    }

    if (SIGNATURE_TYPE == 22){
        CHUNK_NUMBER = 5;
    }

    if (SIGNATURE_TYPE == 23){
        CHUNK_NUMBER = 3;
        HASH_TYPE = 160;
    }


    var DG_HASH_BLOCK_SIZE = 1024;
    if (DG_HASH_TYPE <= 256){
        DG_HASH_BLOCK_SIZE = 512;
    }
    var HASH_BLOCK_SIZE = 1024;
    if (HASH_TYPE <= 256){
        HASH_BLOCK_SIZE = 512;
    }


    var DG1_LEN = 1024;
    var SIGNED_ATTRIBUTES_LEN = 1024;

    var PUBKEY_LEN;
    var SIGNATURE_LEN;

    //ECDSA
    if (SIGNATURE_TYPE >= 20){
        PUBKEY_LEN    = 2 * CHUNK_NUMBER * CHUNK_SIZE;
        SIGNATURE_LEN = 2 * CHUNK_NUMBER * CHUNK_SIZE;
    }
    //RSA||RSAPSS
    if (SIGNATURE_TYPE < 20){
        PUBKEY_LEN    = CHUNK_NUMBER;
        SIGNATURE_LEN = CHUNK_NUMBER;
    }


    // INPUT SIGNALS:
    signal input encapsulatedContent[EC_BLOCK_NUMBER * HASH_BLOCK_SIZE];
    signal input dg1[DG1_LEN];
    signal input dg15[DG15_BLOCK_NUMBER * HASH_BLOCK_SIZE];
    signal input signedAttributes[SIGNED_ATTRIBUTES_LEN];
    signal input signature[SIGNATURE_LEN];
    signal input pubkey[PUBKEY_LEN];
    signal input slaveMerkleRoot;
    signal input slaveMerkleInclusionBranches[TREE_DEPTH];
    signal input skIdentity;


    signal output dg15PubKeyHash;
    signal output passportHash;
    signal output dg1Commitment;
    signal output pkIdentityHash;

    dg15PubKeyHash <== 0;
    passportHash <== 0;
    dg1Commitment <== 0;
    pkIdentityHash <== 0;
}



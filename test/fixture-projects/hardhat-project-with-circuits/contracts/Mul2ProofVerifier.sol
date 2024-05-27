// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

interface IMul2Verifier {
    function verifyProof(
        uint256[2] calldata pA_,
        uint256[2][2] calldata pB_,
        uint256[2] calldata pC_,
        uint256[1] calldata pubSignals_
    ) external view;
}

contract Mul2ProofVerifier {
    IMul2Verifier public verifier;

    mapping (address => bool) public isVerified;

    constructor (address verifierAddr_) {
        verifier = IMul2Verifier(verifierAddr_);
    }

    function verifyProof(
        uint256[2] calldata pA_,
        uint256[2][2] calldata pB_,
        uint256[2] calldata pC_,
        uint256[1] calldata pubSignals_
    ) external {
        verifier.verifyProof(pA_, pB_, pC_, pubSignals_);

        isVerified[msg.sender] = true;
    }
}
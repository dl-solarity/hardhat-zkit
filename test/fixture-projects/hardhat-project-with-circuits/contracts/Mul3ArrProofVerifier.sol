// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

interface IMul3ArrVerifier {
    function verifyProof(
        uint256[2] calldata pA_,
        uint256[2][2] calldata pB_,
        uint256[2] calldata pC_,
        uint256[1] calldata pubSignals_
    ) external view;
}

contract Mul3ArrProofVerifier {
    IMul3ArrVerifier public verifier;

    mapping (address => bool) public isVerified;

    constructor (address verifierAddr_) {
        verifier = IMul3ArrVerifier(verifierAddr_);
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
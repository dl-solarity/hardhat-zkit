pragma circom 2.0.0;

include "circomlib/circuits/poseidon.circom";

template Hash2(){
   signal input in1;
   signal input in2;
   signal output out;

   component h = Poseidon(2);
    h.inputs[0] <== in1;
    h.inputs[1] <== in2;

    out <== h.out;
}

component main = Hash2();
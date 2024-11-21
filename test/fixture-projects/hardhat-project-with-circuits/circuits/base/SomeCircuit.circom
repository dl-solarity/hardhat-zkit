pragma circom 2.1.6;

template SomeCircuit(p1, p2){
   signal input in1;
   signal input in2[p1[1] * p1[0]][p1[3] * p1[2] * p2];

   signal output out <== in1 * in2[0][0];
}

component main {public [in1]} = SomeCircuit([5, 3, 2, 5], 3);

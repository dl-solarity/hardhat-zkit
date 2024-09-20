pragma circom 2.1.9;

template SumMul(){
   signal input in1;
   signal input in2;
   signal input in3;
   signal output out;

   out <== in1 + in2 * in3;
}

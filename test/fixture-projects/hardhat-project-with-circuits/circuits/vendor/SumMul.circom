pragma circom 2.0.0;

template SumMul(){
   signal input in1;
   signal input in2;
   signal input in3;
   signal output out;

   signal tmp <-- in1 + in2;
   out <== tmp * in3;
}

component main = SumMul();
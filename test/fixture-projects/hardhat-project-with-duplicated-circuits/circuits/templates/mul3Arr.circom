pragma circom 2.0.0;

template Multiplier3Arr(count){
   signal input in[count];

   signal output out;
   signal output result[count];

   signal tmp <-- in[0] * in[1];

   out <== tmp * in[2];
}

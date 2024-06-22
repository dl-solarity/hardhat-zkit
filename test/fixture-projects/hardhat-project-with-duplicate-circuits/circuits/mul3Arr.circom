pragma circom 2.0.0;

template Multiplier3Arr(){
   signal input in[3];
   signal output out;

   signal tmp <-- in[0] * in[1];

   out <== tmp * in[2];
}

component main = Multiplier3Arr();
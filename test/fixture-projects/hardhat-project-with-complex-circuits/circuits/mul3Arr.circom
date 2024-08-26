pragma circom 2.0.0;

function getValue() {
   return 2 + 1;
}

template Multiplier3Arr(count){
   signal input in[count];
   signal output out;

   signal tmp <-- in[0] * in[1];

   out <== tmp * in[2];
}

component main = Multiplier3Arr(getValue());
pragma circom 2.1.8;

template Test(a){
   signal input in[a];
   signal output out;

   signal tmp <-- in[0] * in[1];

   out <== tmp * in[2];
}

component main = Test(10);

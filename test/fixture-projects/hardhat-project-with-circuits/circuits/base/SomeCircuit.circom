pragma circom 2.1.6;

include "templates/SomeCircuit.circom";

component main {public [in1]} = SomeCircuit([5, 3, 2, 5], 3);

pragma circom 2.0.0;

template ComplexCircuitWithSimplifications() {
    // Declare signals
    signal input a;
    signal input b;
    signal input c;
    signal input d;

    // Intermediate signals
    signal x1;
    signal x2;
    signal x3;
    signal x4;

    // Output signal
    signal y;

    // Linear constraints
    x1 <== a + b;
    x2 <== c + d;

    // Non-linear constraints
    x3 <== x1 * x2;

    // More linear combinations
    x4 <== x3 + c;

    // Equality constraints that can be simplified
    signal eq1;
    eq1 <== x1;

    signal eq2;
    eq2 <== x2;

    signal eq3;
    eq3 <== eq1 + eq2;

    y <== x4;
}

// Instantiate the circuit
component main = ComplexCircuitWithSimplifications();

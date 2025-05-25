// Offense Calculator Logic
document.addEventListener('DOMContentLoaded', function() {
    // Get all input elements
    const inputs = document.querySelectorAll('.mb-input-wrapper input');
    
    // Function to calculate attack power
    function calculateAttackPower(acc, dmg, str, strMult, as, cr, cd) {
        return Math.round(Math.pow(1.07, acc) * (dmg + str * strMult) * as + (cr * cd * as) * 10) / 10;
    }
    
    // Function to calculate defense power
    function calculateDefensePower(hp, ac) {
        return Math.round(hp * Math.pow(1.07, ac) * 10) / 10;
    }
    
    // Function to calculate time to kill
    function calculateTTK(defensePower, attackPower) {
        return Math.round((defensePower / attackPower) * 100) / 100;
    }
    
    // Function to update all calculations
    function updateCalculations() {
        // Get all input values
        const acc = parseFloat(inputs[0].value) || 0;
        const dmg = parseFloat(inputs[1].value) || 0;
        const cd = parseFloat(inputs[2].value) || 0;
        const as = parseFloat(inputs[3].value) || 0;
        const ac = parseFloat(inputs[4].value) || 0;
        const hp = parseFloat(inputs[5].value) || 0;
        const cr = parseFloat(inputs[6].value) || 0;
        const str = parseFloat(inputs[7].value) || 0;
        const strMult = parseFloat(inputs[8].value) || 0;
        
        // Calculate values
        const attackPower = calculateAttackPower(acc, dmg, str, strMult, as, cr, cd);
        const defensePower = calculateDefensePower(hp, ac);
        const ttk = calculateTTK(defensePower, attackPower);
        
        // Update display values
        const mathElements = document.querySelectorAll('.mb-view-wrapper.mb-view-type-math');
        if (mathElements.length >= 3) {
            mathElements[0].textContent = attackPower;
            mathElements[1].textContent = defensePower;
            mathElements[2].textContent = ttk;
        }
    }
    
    // Add event listeners to all inputs
    inputs.forEach(input => {
        input.addEventListener('input', updateCalculations);
    });
    
    // Initial calculation
    updateCalculations();
}); 
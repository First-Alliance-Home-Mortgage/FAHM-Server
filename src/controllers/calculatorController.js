const createError = require('http-errors');

function calcMonthlyPayment(principal, annualRate, termYears) {
  const r = annualRate / 100 / 12;
  const n = termYears * 12;
  if (r === 0) return principal / n;
  return (principal * r) / (1 - Math.pow(1 + r, -n));
}

exports.calculate = (req, res, next) => {
  try {
    const { amount, rate, termYears, taxesAnnual = 0, insuranceAnnual = 0, hoaMonthly = 0 } = req.body;
    if (!amount || !rate || !termYears) {
      return next(createError(400, 'amount, rate, and termYears are required'));
    }
    if (amount <= 0 || rate <= 0 || termYears <= 0) {
      return next(createError(400, 'amount, rate, and termYears must be positive'));
    }
    const pAndI = calcMonthlyPayment(Number(amount), Number(rate), Number(termYears));
    const monthlyTaxes = Number(taxesAnnual) / 12;
    const monthlyInsurance = Number(insuranceAnnual) / 12;
    const totalMonthly = pAndI + monthlyTaxes + monthlyInsurance + Number(hoaMonthly || 0);

    // APR approximation: nominal rate shown; real APR requires fees—placeholder here.
    const apr = Number(rate);

    return res.json({
      monthlyPrincipalAndInterest: Number(pAndI.toFixed(2)),
      monthlyTaxes: Number(monthlyTaxes.toFixed(2)),
      monthlyInsurance: Number(monthlyInsurance.toFixed(2)),
      monthlyHoa: Number(hoaMonthly || 0),
      totalMonthly: Number(totalMonthly.toFixed(2)),
      apr,
    });
  } catch (err) {
    return next(err);
  }
};


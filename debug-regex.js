const testInput = `Mode of Communication
: Session conducted via secure real-time audio and video.
Patient Location
: Patient located at home; address confirmed.
Provider Location
: Provider located in clinic office.`;

console.log('INPUT:');
console.log(testInput);

console.log('\nAfter first regex ([A-Za-z0-9\\s]+)\\n\\s*:\\s*:');
let result1 = testInput.replace(/([A-Za-z0-9\s]+)\n\s*:\s*/g, '$1: ');
console.log(result1);

console.log('\nAfter specific pattern regex:');
let result2 = testInput.replace(/(Mode of Communication|Patient Location|Provider Location|Consent Obtained|Other Participants|Before Visit|After Visit)\s*\n\s*:\s*/g, '$1: ');
console.log(result2);

console.log('\nTesting if the pattern even matches:');
const matches = testInput.match(/(Mode of Communication|Patient Location|Provider Location)\s*\n\s*:\s*/g);
console.log('Matches found:', matches); 
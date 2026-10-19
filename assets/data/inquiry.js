// Public draft preparation only. No submission endpoint or personal-data storage.
export const interests = ['Blackfoot Unmanned Systems', 'Counter-UAS', 'Operator Training', 'Engineering & Integration', 'Fielding & Support', 'General Business Partnership'];
export const evaluationStages = ['Initial research', 'Evaluating capabilities', 'Planning procurement', 'Seeking integration support', 'Exploring a partnership'];

const aliases = new Map([
  ['Blackfoot', interests[0]], ['Drone training', interests[2]],
  ['Engineering', interests[3]], ['Field support', interests[4]],
  ['Other UAS requirement', interests[5]]
]);
const courses = ['Tactical Drone Operator', 'FPV operator training', 'Build-and-Fly', 'Operators + maintainers', 'Counter-UAS training', 'Instructor development'];

export function inquiryContext(search) {
  const params = new URLSearchParams(search);
  const requested = params.get('interest');
  const interest = interests.includes(requested) ? requested : aliases.get(requested)
    || (/^Blackfoot (Chief|Scout|Raider)$/.test(requested) ? interests[0] : '')
    || (courses.includes(requested) ? interests[2] : '');
  const detail = /^Blackfoot (Chief|Scout|Raider)$/.test(requested) || courses.includes(requested) ? requested : '';
  return { interest, detail, briefing: params.get('intent') === 'briefing' };
}

export function prepareInquiry(data, recipients, briefing = false) {
  const value = key => String(data.get(key) || '').trim();
  const interest = value('interest');
  if (!interests.includes(interest)) throw new Error('Choose an area of interest.');
  const subject = `T3i ${briefing ? 'capability briefing request' : 'requirements inquiry'}: ${interest}`;
  const address = interest === 'Operator Training' ? recipients.trainingEmail : recipients.email;
  const body = [
    `Name: ${value('name')}`, `Organization: ${value('organization')}`, `Work email: ${value('email')}`,
    value('phone') && `Phone: ${value('phone')}`, `Area of interest: ${interest}`,
    value('stage') && `Evaluation stage: ${value('stage')}`, value('message') && `\nRequirements:\n${value('message')}`
  ].filter(Boolean).join('\n');
  return { text: `To: ${address}\nSubject: ${subject}\n\n${body}`, mailto: `mailto:${address}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}` };
}

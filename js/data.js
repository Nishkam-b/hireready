// Static data: job profiles, Indian cities, sample resume for template previews.

export const JOB_PROFILES = [
  'Software Developer', 'Frontend Developer', 'Backend Developer', 'Full Stack Developer', 'Data Analyst', 'Data Scientist',
  'Digital Marketing Executive', 'Digital Marketing Manager', 'SEO Specialist', 'Graphic Designer', 'UI/UX Designer',
  'Content Writer', 'Social Media Manager', 'Video Editor', 'Photographer', 'Sales Executive', 'Business Development Executive',
  'Business Analyst', 'HR Executive', 'Accountant', 'Chartered Accountant', 'Customer Support Executive', 'BPO / Call Centre Executive',
  'Project Manager', 'Product Manager', 'Teacher', 'Mechanical Engineer', 'Civil Engineer', 'Electrical Engineer',
  'Bank PO / Banking Associate', 'Operations Executive', 'Nurse', 'Pharmacist', 'Fresher / Graduate',
];

export const EXPERIENCE_LEVELS = [
  { id: 'student', label: 'Student', desc: 'Still studying, looking for internships', icon: 'cap' },
  { id: 'fresher', label: 'Fresher', desc: 'Graduated, little or no work experience', icon: 'star' },
  { id: 'experienced', label: 'Experienced', desc: '1+ years of work experience', icon: 'briefcase' },
  { id: 'switcher', label: 'Career switcher', desc: 'Moving to a new field or role', icon: 'refresh' },
];

export const IN_CITIES = [
  'Mumbai, Maharashtra', 'Pune, Maharashtra', 'Nagpur, Maharashtra', 'Delhi, NCR', 'Gurugram, Haryana', 'Noida, Uttar Pradesh',
  'Bengaluru, Karnataka', 'Mysuru, Karnataka', 'Hyderabad, Telangana', 'Chennai, Tamil Nadu', 'Coimbatore, Tamil Nadu', 'Kolkata, West Bengal',
  'Ahmedabad, Gujarat', 'Surat, Gujarat', 'Vadodara, Gujarat', 'Jaipur, Rajasthan', 'Jodhpur, Rajasthan', 'Udaipur, Rajasthan',
  'Sri Ganganagar, Rajasthan', 'Kota, Rajasthan', 'Lucknow, Uttar Pradesh', 'Kanpur, Uttar Pradesh', 'Indore, Madhya Pradesh',
  'Bhopal, Madhya Pradesh', 'Chandigarh', 'Ludhiana, Punjab', 'Amritsar, Punjab', 'Kochi, Kerala', 'Thiruvananthapuram, Kerala',
  'Bhubaneswar, Odisha', 'Patna, Bihar', 'Ranchi, Jharkhand', 'Guwahati, Assam', 'Dehradun, Uttarakhand', 'Visakhapatnam, Andhra Pradesh', 'Remote',
];

export const SAMPLE = {
  personal: {
    fullName: 'Nishkam Bhatia', headline: 'Digital Marketing & AI Content Creator', email: 'nishkam@example.com', phone: '+91 98765 43210',
    location: 'Sri Ganganagar, Rajasthan', linkedin: 'linkedin.com/in/nishkambhatia', website: 'nishtekmedia.com', github: '', photo: '',
  },
  summary: 'Digital marketing professional with 5+ years of experience in content strategy, social media growth and AI-powered tools. Skilled in creating data-driven campaigns that build brand visibility and engagement.',
  sections: {
    experience: [
      { id: 's1', title: 'Digital Marketing Manager', company: 'Nishtek Media', location: '', start: '2023-01', end: '', current: true, bullets: ['Led content and social media strategy, growing audience to 700K+ across platforms.', 'Created and optimised campaigns using AI tools, improving engagement by 62%.'] },
      { id: 's2', title: 'Content Creator', company: 'Freelance', location: '', start: '2021-06', end: '2022-12', bullets: ['Produced educational content on AI tools, technology and creativity.', 'Collaborated with leading tech brands for product campaigns and reviews.'] },
    ],
    education: [{ id: 's3', degree: 'Bachelor of Computer Applications (BCA)', institution: 'Rajasthan University', start: '2014', end: '2017' }],
    skills: ['Digital Marketing', 'Content Strategy', 'Social Media', 'SEO', 'AI Tools', 'Video Editing', 'Analytics', 'Canva', 'Google Ads'],
    languages: [{ id: 's4', name: 'English', level: 'Fluent' }, { id: 's5', name: 'Hindi', level: 'Native' }],
  },
  sectionOrder: ['summary', 'experience', 'education', 'skills', 'languages'],
  hidden: {},
  customTitles: {},
  style: { template: 'classic', fontSize: 10.5, lineHeight: 1.35, margin: 16, sectionGap: 12, pageSize: 'a4', dateFormat: 'MMM YYYY', showPhoto: true },
};

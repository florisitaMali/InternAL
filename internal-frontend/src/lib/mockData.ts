import { Application, Company, Opportunity, Student, PPA, Department, StudyField } from '@/src/types';

export const mockUniversities = [
  { id: 'u1', name: 'Global Tech University', location: 'New York', email: 'admin@gtu.edu' },
  { id: 'u2', name: 'Innovation Institute', location: 'San Francisco', email: 'admin@ii.edu' },
];

export const mockDepartments: Department[] = [
  { id: 'd1', name: 'Computer Science', universityName: 'Global Tech University' },
  { id: 'd2', name: 'Engineering', universityName: 'Global Tech University' },
];

export const mockStudyFields: StudyField[] = [
  { id: 'sf1', name: 'Software Engineering', departmentId: 'd1' },
  { id: 'sf2', name: 'Data Science', departmentId: 'd1' },
  { id: 'sf3', name: 'Mechanical Engineering', departmentId: 'd2' },
];

export const mockStudents: Student[] = [
  {
    id: 's1',
    fullName: 'Alice Johnson',
    email: 'alice@gtu.edu',
    role: 'STUDENT',
    university: 'Global Tech University',
    departmentId: 'd1',
    studyFieldId: 'sf1',
    studyYear: 3,
    cgpa: 3.8,
    hasCompletedPP: false,
    extendedProfile: {
      description: 'Passionate software developer with a focus on web technologies.',
      skills: ['React', 'TypeScript', 'Node.js'],
      certificates: ['AWS Certified Developer'],
      languages: ['English', 'Spanish'],
      experience: ['Summer Internship at TechCorp'],
      hobbies: ['Coding', 'Hiking'],
    }
  },
  {
    id: 's2',
    fullName: 'Bob Smith',
    email: 'bob@gtu.edu',
    role: 'STUDENT',
    university: 'Global Tech University',
    departmentId: 'd1',
    studyFieldId: 'sf2',
    studyYear: 2,
    cgpa: 3.5,
    hasCompletedPP: false,
  }
];

export const mockPPAs: PPA[] = [
  {
    id: 'p1',
    fullName: 'Dr. Sarah Wilson',
    email: 'sarah.wilson@gtu.edu',
    role: 'PPA',
    departmentId: 'd1',
    supervisedFieldIds: ['sf1', 'sf2'],
  }
];

export const mockCompanies: Company[] = [
  {
    id: 'c1',
    name: 'TechCorp Solutions',
    email: 'hr@techcorp.com',
    industry: 'Software Development',
    description: 'A leading technology company specializing in enterprise solutions.'
  },
  {
    id: 'c2',
    name: 'DataFlow Inc.',
    email: 'careers@dataflow.io',
    industry: 'Data Analytics',
    description: 'Empowering businesses with data-driven insights.'
  }
];

export const mockOpportunities: Opportunity[] = [
  {
    id: 'o1',
    companyId: 'c1',
    companyName: 'TechCorp Solutions',
    title: 'Frontend Developer Intern',
    description: 'Looking for a React enthusiast to join our UI team.',
    requiredSkills: ['React', 'Tailwind CSS', 'TypeScript'],
    requiredExperience: 'Basic knowledge of web development',
    deadline: '2026-05-01',
    targetUniversityIds: ['u1', 'u2'],
    type: 'PROFESSIONAL_PRACTICE',
    location: 'New York',
    isPaid: true,
    workMode: 'Hybrid',
  },
  {
    id: 'o2',
    companyId: 'c2',
    companyName: 'DataFlow Inc.',
    title: 'Data Analyst Intern',
    description: 'Join our analytics team to help process large datasets.',
    requiredSkills: ['Python', 'SQL', 'Pandas'],
    requiredExperience: 'Knowledge of statistics',
    deadline: '2026-06-15',
    targetUniversityIds: ['u1'],
    type: 'INDIVIDUAL_GROWTH',
    location: 'San Francisco',
    isPaid: false,
    workMode: 'Remote',
  }
];

export const mockApplications: Application[] = [
  {
    id: 'a1',
    studentId: 's1',
    studentName: 'Alice Johnson',
    companyId: 'c1',
    companyName: 'TechCorp Solutions',
    opportunityId: 'o1',
    opportunityTitle: 'Frontend Developer Intern',
    type: 'PROFESSIONAL_PRACTICE',
    isApprovedByPPA: true,
    isApprovedByCompany: false,
    createdAt: '2026-03-20',
    status: 'PENDING'
  },
  {
    id: 'a2',
    studentId: 's2',
    studentName: 'Bob Smith',
    companyId: 'c2',
    companyName: 'DataFlow Inc.',
    opportunityId: 'o2',
    opportunityTitle: 'Data Analyst Intern',
    type: 'INDIVIDUAL_GROWTH',
    isApprovedByCompany: true,
    createdAt: '2026-03-22',
    status: 'APPROVED'
  }
];

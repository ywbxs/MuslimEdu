#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const root = process.cwd();
const files = {
  nav: path.join(root, 'src/navigation/RootNavigator.tsx'),
  admin: path.join(root, 'src/screens/dashboards/AdminDashboard.tsx'),
  student: path.join(root, 'src/screens/dashboards/StudentDashboard.tsx'),
};
let failed = false;
function fail(x){ console.error('✗ '+x); failed=true; }
function read(k){ if(!fs.existsSync(files[k])){fail(`${files[k]} not found`);return null;} return fs.readFileSync(files[k],'utf8'); }
function write(k,s){fs.writeFileSync(files[k],s,'utf8');}
function addOnce(s, marker, text, label){ if(s.includes(text.trim())) return s; const i=s.indexOf(marker); if(i<0){fail(`${label}: anchor not found: ${marker}`);return s;} return s.slice(0,i)+text+'\n'+s.slice(i); }
function routeBlock(name, component){ return ` <Stack.Screen\n name="${name}"\n component={${component}}\n options={{ animation: 'slide_from_right' }}\n />\n`; }

let nav=read('nav');
if(nav){
 const imports = [
  "import StudentIdentityScreen from '../screens/student/StudentIdentityScreen';",
  "import AcademicFacilitiesScreen from '../screens/teachers/AcademicFacilitiesScreen';",
  "import AcademicScheduleScreen from '../screens/teachers/AcademicScheduleScreen';",
  "import AcademicCalendarScreen from '../screens/teachers/AcademicCalendarScreen';",
  "import AcademicAnalyticsScreen from '../screens/teachers/AcademicAnalyticsScreen';",
  "import AcademicCompletionHubScreen from '../screens/teachers/AcademicCompletionHubScreen';",
 ];
 for(const imp of imports) nav=addOnce(nav,"import SubjectFormScreen from '../screens/admin/SubjectFormScreen';",imp,'RootNavigator import');
 const routes = [
  ['StudentIdentity','StudentIdentityScreen'],['AcademicFacilities','AcademicFacilitiesScreen'],['AcademicSchedule','AcademicScheduleScreen'],['AcademicCalendar','AcademicCalendarScreen'],['AcademicAnalytics','AcademicAnalyticsScreen'],['AcademicCompletionHub','AcademicCompletionHubScreen'],
 ];
 const marker=' <Stack.Screen\n name="SubjectForm"';
 for(const [name,comp] of routes) nav=addOnce(nav,marker,routeBlock(name,comp),'RootNavigator route');
 write('nav',nav);
}

let admin=read('admin');
if(admin){
 const cardMarker=" key: 'fees',";
 const cards=[
  ` { key: 'academicFacilities', title: 'Facilities', desc: 'Buildings, rooms and learning spaces', variant: 'soft', route: 'AcademicFacilities', icon: (c) => <CatalogIcon color={c} />, },\n`,
  ` { key: 'academicSchedule', title: 'Timetable', desc: 'Conflict-checked school schedules', variant: 'soft', route: 'AcademicSchedule', icon: (c) => <CalendarIcon color={c} />, },\n`,
  ` { key: 'academicCalendar', title: 'Calendar', desc: 'Exams, holidays and school events', variant: 'soft', route: 'AcademicCalendar', icon: (c) => <CalendarIcon color={c} />, },\n`,
  ` { key: 'academicAnalytics', title: 'Analytics', desc: 'Read-only academic KPIs', variant: 'soft', route: 'AcademicAnalytics', icon: (c) => <ReportDocIcon color={c} />, },\n`,
  ` { key: 'completionHub', title: 'Completion Hub', desc: 'Six-phase release health and audit', variant: 'soft', route: 'AcademicCompletionHub', icon: (c) => <ReportDocIcon color={c} />, },\n`,
 ];
 for(const card of cards) admin=addOnce(admin,cardMarker,card,'AdminDashboard card');
 write('admin',admin);
}

let student=read('student');
if(student){
 const marker=' title="Announcements"';
 const card=` title="Student ID"\n description="Official student number and school identity"\n onPress={() => (navigation as any).navigate('StudentIdentity')}\n />\n }\n`;
 student=addOnce(student,marker,card,'StudentDashboard identity entry');
 write('student',student);
}
if(failed) process.exit(1);
console.log('Integration wiring applied. Re-running is safe.');

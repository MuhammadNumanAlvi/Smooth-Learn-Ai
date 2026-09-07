const fs = require('fs');
let code = fs.readFileSync('src/components/Navbar.tsx', 'utf8');

code = code.replace("import { logoutUser, subscribeToAuth } from '../lib/firebase';", "import { logoutUser, subscribeToAuth } from '../lib/firebase';\nimport { getUserRole } from '../lib/firestoreClient';\nimport { useNavigate } from 'react-router-dom';");

code = code.replace("const [currentUser, setCurrentUser] = useState<any>(null);", "const [currentUser, setCurrentUser] = useState<any>(null);\n  const [isAdmin, setIsAdmin] = useState(false);\n  const navigate = useNavigate();");

code = code.replace(/  useEffect\(\(\) => \{\n    const unsubscribe = subscribeToAuth\(\(user\) => \{\n      setCurrentUser\(user\);\n    \}\);\n    return \(\) => unsubscribe\(\);\n  \}, \[\]\);/, `  useEffect(() => {
    const unsubscribe = subscribeToAuth(async (user) => {
      setCurrentUser(user);
      if (user && !user.isAnonymous) {
        const role = await getUserRole(user.uid);
        setIsAdmin(role === 'admin');
      } else {
        setIsAdmin(false);
      }
    });
    return () => unsubscribe();
  }, []);`);

code = code.replace(/\{!currentUser \|\| currentUser.isAnonymous \? \(/, `{isAdmin && (
                      <button
                        onClick={() => {
                          setUserDropdownOpen(false);
                          navigate('/admin');
                        }}
                        className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-slate-50 text-slate-700 font-semibold flex items-center space-x-2 transition-colors cursor-pointer mb-1"
                      >
                        <ShieldAlert className="w-3.5 h-3.5 text-slate-500" />
                        <span>Admin Dashboard</span>
                      </button>
                    )}
                    {!currentUser || currentUser.isAnonymous ? (`);

code = code.replace("import {", "import {\n  ShieldAlert,");

fs.writeFileSync('src/components/Navbar.tsx', code);
console.log('patched');

const fs = require('fs');
let code = fs.readFileSync('src/components/Navbar.tsx', 'utf8');

// fix imports
code = code.replace(/import \{ auth, logoutUser, subscribeToAuth \} from '\.\.\/lib\/firebase';/, "import { auth, logoutUser, subscribeToAuth } from '../lib/firebase';\nimport { getUserRole } from '../lib/firestoreClient';\nimport { useNavigate } from 'react-router-dom';");

// fix state
code = code.replace(/const \[currentUser, setCurrentUser\] = useState<User \| null>\(auth\.currentUser\);/, "const [currentUser, setCurrentUser] = useState<User | null>(auth.currentUser);\n  const [isAdmin, setIsAdmin] = useState(false);\n  const navigate = useNavigate();");

fs.writeFileSync('src/components/Navbar.tsx', code);
console.log('Fixed Navbar');

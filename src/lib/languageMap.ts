export interface LanguageDefinition {
  name: string;
  color: string;
}

const EXTENSION_MAP: Record<string, LanguageDefinition> = {
  // APL family (explicitly mapping .apl and related Dyalog/APL extensions)
  '.apl': { name: 'APL', color: '#22C55E' },
  '.aplf': { name: 'APL', color: '#22C55E' },
  '.aplc': { name: 'APL', color: '#22C55E' },
  '.apln': { name: 'APL', color: '#22C55E' },
  '.apli': { name: 'APL', color: '#22C55E' },
  '.aplo': { name: 'APL', color: '#22C55E' },
  '.dyalog': { name: 'APL', color: '#22C55E' },

  // Web & TypeScript / JavaScript
  '.ts': { name: 'TypeScript', color: '#3178C6' },
  '.tsx': { name: 'TypeScript', color: '#3178C6' },
  '.mts': { name: 'TypeScript', color: '#3178C6' },
  '.cts': { name: 'TypeScript', color: '#3178C6' },
  '.js': { name: 'JavaScript', color: '#F7DF1E' },
  '.jsx': { name: 'JavaScript', color: '#F7DF1E' },
  '.mjs': { name: 'JavaScript', color: '#F7DF1E' },
  '.cjs': { name: 'JavaScript', color: '#F7DF1E' },
  '.vue': { name: 'Vue', color: '#41B883' },
  '.svelte': { name: 'Svelte', color: '#FF3E00' },
  '.astro': { name: 'Astro', color: '#FF5D01' },
  '.html': { name: 'HTML', color: '#E34C26' },
  '.htm': { name: 'HTML', color: '#E34C26' },
  '.css': { name: 'CSS', color: '#563D7C' },
  '.scss': { name: 'SCSS', color: '#C6538C' },
  '.sass': { name: 'Sass', color: '#A53B70' },
  '.less': { name: 'Less', color: '#1D365D' },

  // Systems & Compiled Languages
  '.c': { name: 'C', color: '#64748B' },
  '.h': { name: 'C/C++ Header', color: '#94A3B8' },
  '.cpp': { name: 'C++', color: '#F34B7D' },
  '.cc': { name: 'C++', color: '#F34B7D' },
  '.cxx': { name: 'C++', color: '#F34B7D' },
  '.hpp': { name: 'C++', color: '#F34B7D' },
  '.hh': { name: 'C++', color: '#F34B7D' },
  '.rs': { name: 'Rust', color: '#DEA584' },
  '.go': { name: 'Go', color: '#00ADD8' },
  '.zig': { name: 'Zig', color: '#EC915C' },
  '.nim': { name: 'Nim', color: '#FFE953' },
  '.v': { name: 'V / Verilog', color: '#4F87C4' },
  '.sv': { name: 'SystemVerilog', color: '#DAE1C2' },
  '.vhd': { name: 'VHDL', color: '#ADB2CB' },
  '.vhdl': { name: 'VHDL', color: '#ADB2CB' },
  '.asm': { name: 'Assembly', color: '#6E4C13' },
  '.s': { name: 'Assembly', color: '#6E4C13' },

  // JVM & .NET
  '.java': { name: 'Java', color: '#B07219' },
  '.kt': { name: 'Kotlin', color: '#A97BFF' },
  '.kts': { name: 'Kotlin', color: '#A97BFF' },
  '.scala': { name: 'Scala', color: '#DC322F' },
  '.groovy': { name: 'Groovy', color: '#4298B8' },
  '.cs': { name: 'C#', color: '#178600' },
  '.fs': { name: 'F#', color: '#B845FC' },
  '.fsx': { name: 'F#', color: '#B845FC' },
  '.vb': { name: 'Visual Basic', color: '#945DB7' },

  // Scripting, Dynamic & Functional
  '.py': { name: 'Python', color: '#3572A5' },
  '.pyw': { name: 'Python', color: '#3572A5' },
  '.pyi': { name: 'Python', color: '#3572A5' },
  '.rb': { name: 'Ruby', color: '#CC342D' },
  '.rake': { name: 'Ruby', color: '#CC342D' },
  '.php': { name: 'PHP', color: '#4F5D95' },
  '.swift': { name: 'Swift', color: '#F05138' },
  '.m': { name: 'Objective-C', color: '#438EFF' },
  '.mm': { name: 'Objective-C++', color: '#6866FB' },
  '.dart': { name: 'Dart', color: '#00B4AB' },
  '.lua': { name: 'Lua', color: '#000080' },
  '.pl': { name: 'Perl', color: '#0298C3' },
  '.pm': { name: 'Perl', color: '#0298C3' },
  '.r': { name: 'R', color: '#198CE7' },
  '.rmd': { name: 'R Markdown', color: '#198CE7' },
  '.jl': { name: 'Julia', color: '#A270BA' },
  '.ex': { name: 'Elixir', color: '#6E4A7E' },
  '.exs': { name: 'Elixir', color: '#6E4A7E' },
  '.erl': { name: 'Erlang', color: '#B83998' },
  '.hrl': { name: 'Erlang', color: '#B83998' },
  '.hs': { name: 'Haskell', color: '#5E5086' },
  '.lhs': { name: 'Haskell', color: '#5E5086' },
  '.ml': { name: 'OCaml', color: '#3BE133' },
  '.mli': { name: 'OCaml', color: '#3BE133' },
  '.clj': { name: 'Clojure', color: '#DB5855' },
  '.cljs': { name: 'ClojureScript', color: '#DB5855' },
  '.cljc': { name: 'Clojure', color: '#DB5855' },
  '.lisp': { name: 'Common Lisp', color: '#3FB68B' },
  '.el': { name: 'Emacs Lisp', color: '#C065DB' },
  '.scm': { name: 'Scheme', color: '#1E4AEC' },
  '.rkt': { name: 'Racket', color: '#3C5CAA' },
  '.bqn': { name: 'BQN', color: '#2B7067' },
  '.ijs': { name: 'J', color: '#9EEDFF' },
  '.q': { name: 'q', color: '#0040CD' },
  '.k': { name: 'K', color: '#28430A' },

  // Scientific & Legacy
  '.f90': { name: 'Fortran', color: '#4D41B1' },
  '.f95': { name: 'Fortran', color: '#4D41B1' },
  '.f03': { name: 'Fortran', color: '#4D41B1' },
  '.f': { name: 'Fortran', color: '#4D41B1' },
  '.for': { name: 'Fortran', color: '#4D41B1' },
  '.cob': { name: 'COBOL', color: '#484D6D' },
  '.cbl': { name: 'COBOL', color: '#484D6D' },
  '.pas': { name: 'Pascal', color: '#E3F171' },
  '.ada': { name: 'Ada', color: '#02F88C' },
  '.adb': { name: 'Ada', color: '#02F88C' },
  '.ads': { name: 'Ada', color: '#02F88C' },

  // Shell & Automation
  '.sh': { name: 'Shell', color: '#89E051' },
  '.bash': { name: 'Shell', color: '#89E051' },
  '.zsh': { name: 'Shell', color: '#89E051' },
  '.fish': { name: 'Shell', color: '#89E051' },
  '.ps1': { name: 'PowerShell', color: '#012456' },
  '.psm1': { name: 'PowerShell', color: '#012456' },
  '.bat': { name: 'Batchfile', color: '#C1F12E' },
  '.cmd': { name: 'Batchfile', color: '#C1F12E' },
  '.nix': { name: 'Nix', color: '#7E7EFF' },
  '.tf': { name: 'HCL', color: '#844FBA' },
  '.tfvars': { name: 'HCL', color: '#844FBA' },
  '.hcl': { name: 'HCL', color: '#844FBA' },
  '.cmake': { name: 'CMake', color: '#DA3434' },

  // Data, Query, Schema & Shaders
  '.sql': { name: 'SQL', color: '#E38C00' },
  '.graphql': { name: 'GraphQL', color: '#E10098' },
  '.gql': { name: 'GraphQL', color: '#E10098' },
  '.proto': { name: 'Protocol Buffers', color: '#5E81AC' },
  '.prisma': { name: 'Prisma', color: '#2D3748' },
  '.sol': { name: 'Solidity', color: '#AA6746' },
  '.move': { name: 'Move', color: '#4A1374' },
  '.cairo': { name: 'Cairo', color: '#FF4A00' },
  '.glsl': { name: 'GLSL', color: '#5686A5' },
  '.hlsl': { name: 'HLSL', color: '#AACE60' },
  '.wgsl': { name: 'WGSL', color: '#1A5E9A' },

  // Config, Markup & Docs
  '.json': { name: 'JSON', color: '#292929' },
  '.jsonc': { name: 'JSON', color: '#292929' },
  '.json5': { name: 'JSON5', color: '#267CB9' },
  '.yaml': { name: 'YAML', color: '#CB171E' },
  '.yml': { name: 'YAML', color: '#CB171E' },
  '.toml': { name: 'TOML', color: '#9C4221' },
  '.xml': { name: 'XML', color: '#0060AC' },
  '.svg': { name: 'SVG', color: '#FF9900' },
  '.ini': { name: 'INI', color: '#64748B' },
  '.conf': { name: 'Config', color: '#64748B' },
  '.env': { name: 'Config', color: '#64748B' },
  '.md': { name: 'Markdown', color: '#38BDF8' },
  '.mdx': { name: 'MDX', color: '#FCB32C' },
  '.rst': { name: 'reStructuredText', color: '#141414' },
  '.tex': { name: 'TeX', color: '#3D6117' },
  '.txt': { name: 'Text', color: '#94A3B8' },
  '.csv': { name: 'CSV', color: '#237346' },
};

const FILENAME_MAP: Record<string, LanguageDefinition> = {
  dockerfile: { name: 'Dockerfile', color: '#384D54' },
  makefile: { name: 'Makefile', color: '#427819' },
  gnumakefile: { name: 'Makefile', color: '#427819' },
  cmakelists: { name: 'CMake', color: '#DA3434' },
  'cmakelists.txt': { name: 'CMake', color: '#DA3434' },
  rakefile: { name: 'Ruby', color: '#CC342D' },
  gemfile: { name: 'Ruby', color: '#CC342D' },
  podfile: { name: 'Ruby', color: '#CC342D' },
  vagrantfile: { name: 'Ruby', color: '#CC342D' },
  justfile: { name: 'Just', color: '#384D54' },
  '.gitignore': { name: 'Ignore List', color: '#475569' },
  '.gitattributes': { name: 'Git Config', color: '#475569' },
  '.editorconfig': { name: 'EditorConfig', color: '#475569' },
  '.prettierrc': { name: 'JSON', color: '#292929' },
  '.eslintrc': { name: 'JSON', color: '#292929' },
};

const BINARY_EXTENSIONS = new Set<string>([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.ico', '.tiff', '.avif', '.psd',
  '.woff', '.woff2', '.ttf', '.otf', '.eot',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.zip', '.tar', '.gz', '.bz2', '.xz', '.7z', '.rar', '.jar', '.war', '.ear',
  '.exe', '.dll', '.so', '.dylib', '.a', '.lib', '.o', '.obj', '.bin', '.wasm', '.pyc', '.pyo', '.class',
  '.mp3', '.wav', '.ogg', '.flac', '.aac', '.mp4', '.webm', '.mov', '.avi', '.mkv',
  '.sqlite', '.db', '.sqlite3', '.lockb', '.pak', '.iso', '.dmg', '.img',
]);

export function extractExtension(filename: string): string {
  const lower = filename.toLowerCase();
  if (!lower.includes('.')) {
    return '(no ext)';
  }
  const lastDot = lower.lastIndexOf('.');
  if (lastDot === 0) {
    return lower;
  }
  return lower.slice(lastDot);
}

export function isBinaryExtension(filename: string): boolean {
  const ext = extractExtension(filename);
  return BINARY_EXTENSIONS.has(ext);
}

export function detectLanguage(filename: string): LanguageDefinition {
  const lowerName = filename.toLowerCase();
  if (FILENAME_MAP[lowerName]) {
    return FILENAME_MAP[lowerName];
  }
  const ext = extractExtension(lowerName);
  if (EXTENSION_MAP[ext]) {
    return EXTENSION_MAP[ext];
  }
  if (ext !== '(no ext)' && ext.length > 1) {
    return {
      name: ext.slice(1).toUpperCase(),
      color: '#64748B',
    };
  }
  return { name: 'Other', color: '#64748B' };
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  const val = bytes / Math.pow(k, i);
  return `${val >= 100 || i === 0 ? val.toFixed(0) : val.toFixed(1)} ${sizes[i]}`;
}

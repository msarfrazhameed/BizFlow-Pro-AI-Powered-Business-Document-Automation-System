import React from 'react';
import { Github, Linkedin, Mail, Twitter, ShieldCheck, Heart } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-slate-950 border-t border-slate-800 text-slate-400 py-12 animate-fade-in">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Main Footer Content */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          
          {/* Brand Column */}
          <div className="col-span-1 md:col-span-1">
            <h3 className="text-white text-lg font-bold mb-2 flex items-center">
              FrazBiz<span className="text-blue-500">Labs</span>
            </h3>
            <p className="text-sm mb-4 text-slate-500 leading-relaxed">
              Automate. Analyze. Act.
              <br/>
              Empowering enterprise workflows with intelligent automation.
            </p>
            <div className="flex space-x-4">
              <a href="#" className="text-slate-500 hover:text-white transition-colors" aria-label="LinkedIn">
                <Linkedin size={20} />
              </a>
              <a href="#" className="text-slate-500 hover:text-white transition-colors" aria-label="Twitter">
                <Twitter size={20} />
              </a>
              <a href="#" className="text-slate-500 hover:text-white transition-colors" aria-label="GitHub">
                <Github size={20} />
              </a>
              <a href="#" className="text-slate-500 hover:text-white transition-colors" aria-label="Email">
                <Mail size={20} />
              </a>
            </div>
          </div>

          {/* Links Column 1 */}
          <div>
            <h4 className="text-slate-200 font-semibold mb-4 text-sm uppercase tracking-wider">Product</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="#" className="hover:text-blue-400 transition-colors">Features</a></li>
              <li><a href="#" className="hover:text-blue-400 transition-colors">Integrations</a></li>
              <li><a href="#" className="hover:text-blue-400 transition-colors">Enterprise</a></li>
              <li><a href="#" className="hover:text-blue-400 transition-colors">Roadmap</a></li>
            </ul>
          </div>

          {/* Links Column 2 */}
          <div>
            <h4 className="text-slate-200 font-semibold mb-4 text-sm uppercase tracking-wider">Company</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="#" className="hover:text-blue-400 transition-colors">About Us</a></li>
              <li><a href="#" className="hover:text-blue-400 transition-colors">Careers</a></li>
              <li><a href="#" className="hover:text-blue-400 transition-colors">Blog</a></li>
              <li><a href="#" className="hover:text-blue-400 transition-colors">Contact</a></li>
            </ul>
          </div>

          {/* Legal / Status */}
          <div>
            <h4 className="text-slate-200 font-semibold mb-4 text-sm uppercase tracking-wider">Legal & Status</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="#" className="hover:text-blue-400 transition-colors">Privacy Policy</a></li>
              <li><a href="#" className="hover:text-blue-400 transition-colors">Terms of Service</a></li>
              <li className="pt-2 flex items-center text-xs text-green-500">
                <div className="w-2 h-2 rounded-full bg-green-500 mr-2 animate-pulse"></div>
                All Systems Operational
              </li>
            </ul>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-slate-800 my-8"></div>

        {/* Bottom Bar */}
        <div className="flex flex-col md:flex-row justify-between items-center text-xs text-slate-600">
          <div className="flex items-center mb-4 md:mb-0">
            <span className="mr-2">&copy; 2025 FrazBiz Labs. All rights reserved.</span>
            <span className="hidden md:inline mx-2 text-slate-700">|</span>
            <span className="flex items-center">
              Powered by AI <SparkleIcon className="ml-1 w-3 h-3 text-blue-500" />
            </span>
          </div>
          <div className="flex items-center space-x-6">
             <span className="flex items-center hover:text-slate-400 transition-colors cursor-pointer">
               <ShieldCheck size={14} className="mr-1" /> Security
             </span>
             <span className="opacity-50">v1.2.0-prod</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

// Helper icon component
const SparkleIcon = ({ className }: { className?: string }) => (
  <svg 
    viewBox="0 0 24 24" 
    fill="currentColor" 
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M12 2L14.39 9.39L22 12L14.39 14.39L12 22L9.61 14.39L2 12L9.61 9.39L12 2Z" />
  </svg>
);

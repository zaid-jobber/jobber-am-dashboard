// Renders a lucide icon by name (data references icons as strings).
import {
  Phone, MessageSquare, Mail, Clock, GitPullRequestArrow, Target, AlertTriangle,
  Megaphone, Trophy, CloudRain, Cloud, Sun, Sprout, Droplets, Scissors, ListChecks,
  CreditCard, Sparkles, ChevronUp, MessageCircle, HelpCircle, RotateCcw, Route,
  Users, Zap, Plug, FileText, ArrowUpCircle, RefreshCw, TrendingUp, TrendingDown,
} from "lucide-react";

const MAP = {
  Phone, MessageSquare, Mail, Clock, GitPullRequestArrow, Target, AlertTriangle,
  Megaphone, Trophy, CloudRain, Cloud, Sun, Sprout, Droplets, Scissors, ListChecks,
  CreditCard, Sparkles, ChevronUp, MessageCircle, RotateCcw, Route,
  Users, Zap, Plug, FileText, ArrowUpCircle, RefreshCw, TrendingUp, TrendingDown,
};

export default function Icon({ name, ...props }) {
  const C = MAP[name] || HelpCircle;
  return <C {...props} />;
}

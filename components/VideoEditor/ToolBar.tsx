import { Scissors, Crop, Palette, Type, Music, Image as ImageIcon, Download, Cloud } from "lucide-react";

export type ToolId = "clip" | "format" | "look" | "text" | "music" | "images" | "export" | "cloud";

const tools: { id: ToolId; icon: React.ReactNode; label: string }[] = [
  { id: "clip", icon: <Scissors className="w-5 h-5" />, label: "Klip" },
  { id: "format", icon: <Crop className="w-5 h-5" />, label: "Formát" },
  { id: "look", icon: <Palette className="w-5 h-5" />, label: "Vzhled" },
  { id: "text", icon: <Type className="w-5 h-5" />, label: "Text" },
  { id: "music", icon: <Music className="w-5 h-5" />, label: "Hudba" },
  { id: "images", icon: <ImageIcon className="w-5 h-5" />, label: "Z obrázků" },
  { id: "export", icon: <Download className="w-5 h-5" />, label: "Export" },
  { id: "cloud", icon: <Cloud className="w-5 h-5" />, label: "Cloud" },
];

interface ToolBarProps {
  activeTool: ToolId;
  onToolSelect: (tool: ToolId) => void;
}

const ToolBar = ({ activeTool, onToolSelect }: ToolBarProps) => (
  <div className="glass-panel p-2">
    <div className="flex gap-1.5 overflow-x-auto">
      {tools.map((tool) => (
        <button
          key={tool.id}
          onClick={() => onToolSelect(tool.id)}
          aria-pressed={activeTool === tool.id}
          className={`tool-button min-w-[54px] flex-1 !p-2 ${activeTool === tool.id ? "tool-button-active" : ""}`}
        >
          {tool.icon}
          <span className="text-[11px] font-medium whitespace-nowrap">{tool.label}</span>
        </button>
      ))}
    </div>
  </div>
);

export default ToolBar;

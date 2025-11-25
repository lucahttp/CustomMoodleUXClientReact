import React, { memo } from "react";
import {
  BookOpen,
  Clock,
  Search,
  Folder,
  FileEdit,
  Headphones,
  MessagesSquare,
  Bug,
} from "lucide-react";

// Utility for color mapping
const getColorClasses = (colorType) => {
  // If it's a hex color (starts with #), return it directly as inline style
  if (typeof colorType === "string" && colorType.startsWith("#")) {
    return colorType; // Will be used as backgroundColor in inline style
  }

  const colors = {
    pink: "bg-[#F2C6C2] text-stone-800",
    beige: "bg-[#F5E1C0] text-stone-800",
    purple: "bg-[#D6D6F5] text-stone-800",
    green: "bg-[#BDEFDB] text-stone-800",
    default: "bg-gray-100 text-stone-800",
  };
  return colors[colorType] || colors.default;
};

// Logo Component
export const Logo = memo(({ onClick }) => (
  <div
    onClick={onClick}
    className="w-16 h-16 bg-stone-100 rounded-xl flex items-center justify-center shadow-sm border border-stone-200 flex-shrink-0 cursor-pointer hover:bg-stone-200 transition-colors"
  >
    <img src={chrome.runtime.getURL("/assets/imgs/utn_logo_small_2.svg")} alt="UTN Logo" className="w-10 h-10" />
  </div>
));

// Sidebar Component
export const Sidebar = memo(
  ({
    sidebarOpen,
    setSidebarOpen,
    searchTitle = "carrera",
    resources = [],
  }) => {
    return (
      <aside
        className={`
            fixed inset-0 z-40 bg-[#F5F0EB] lg:static lg:bg-[#F5F0EB]
            lg:col-span-4 lg:block lg:min-h-[95vh] lg:m-4 lg:rounded-[3rem]
            p-8 lg:p-10 flex flex-col gap-12
            transition-transform duration-500 cubic-bezier(0.4, 0, 0.2, 1)
            ${
              sidebarOpen
                ? "translate-x-0"
                : "translate-x-full lg:translate-x-0"
            }
        `}
      >
        <div className="lg:hidden flex justify-end mb-4">
          <button onClick={() => setSidebarOpen(false)}>
            <svg
              className="w-7 h-7"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="space-y-6 mt-4 lg:mt-12">
          <div className="flex items-start gap-2">
            <BookOpen className="text-green-700 mt-1" size={24} />
            <h2 className="text-2xl font-medium text-stone-900 leading-tight">
              Busca en todo el <br /> contenido de la {searchTitle}
            </h2>
          </div>

          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search
                className="text-stone-400 group-focus-within:text-stone-600 transition-colors"
                size={20}
              />
            </div>
            <input
              type="text"
              className="
                        w-full py-4 pl-12 pr-4
                        bg-[#FEFDF9] border border-transparent hover:border-stone-200 focus:border-stone-300
                        rounded-full shadow-sm text-stone-800 placeholder-stone-400
                        focus:outline-none focus:ring-2 focus:ring-stone-200/50
                        transition-all
                    "
              placeholder="Buscar..."
            />
          </div>
        </div>

        <div className="flex-grow hidden lg:block"></div>

        <div className="mt-auto">
          <h3 className="text-stone-500 text-xs font-semibold uppercase tracking-wider mb-4">
            Ultimos recursos vistos
          </h3>
          <div className="flex flex-col gap-2">
            {resources.map((res) => (
              <div
                key={res.id}
                className="bg-[#FDFBF9] p-4 rounded-2xl flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer mb-3"
              >
                <div className="p-2 bg-transparent rounded-full border border-stone-300 text-stone-800">
                  <Clock size={20} strokeWidth={2} />
                </div>
                <span className="text-stone-700 font-medium text-sm md:text-base">
                  {res.title}
                </span>
              </div>
            ))}
          </div>
        </div>
      </aside>
    );
  }
);

// Course Card Component
export const CourseCard = memo(({ title, color, onClick }) => {
  const isHexColor = typeof color === "string" && color.startsWith("#");
  const textColor = isHexColor ? "#2d3748" : ""; // stone-800 equivalent

  return (
    <div
      onClick={onClick}
      className={`
            ${!isHexColor ? getColorClasses(color) : ""}
            p-8 rounded-[2rem] h-48 flex items-center
            transition-all duration-300 hover:shadow-lg hover:-translate-y-1 cursor-pointer
            shadow-sm/50
        `}
      style={isHexColor ? { backgroundColor: color, color: textColor } : {}}
    >
      <h3 className="text-xl font-medium leading-snug md:text-lg lg:text-xl">
        {title}
      </h3>
    </div>
  );
});

// Filter Pill Component
export const FilterPill = memo(({ icon: Icon, label, active }) => (
  <button
    className={`
        flex items-center gap-2 px-5 py-3 rounded-full text-sm font-medium transition-all
        ${
          active
            ? "bg-stone-900 text-white shadow-md"
            : "bg-white text-stone-600 border border-stone-200 hover:bg-stone-50 hover:border-stone-300"
        }
    `}
  >
    {Icon && <Icon size={18} />}
    {label}
  </button>
));

// Resource Row Card Component
export const ResourceRowCard = memo(({ title, color, type, onClick }) => {
  const getResourceType = (moduleName) => {
    const moduleMap = {
      // Activity types - tareas, quizzes, foros
      assign: "activity",
      quiz: "activity",
      forum: "forum",

      // Virtual meeting types - zoom, bigbluebutton
      zoomutnba: "virtualclass",

      // Folder/Content types - books, files, labels, resources, urls
      book: "folder",
      folder: "folder",
      url: "everythingelse",
      label: "folder",
    };
    return moduleMap[moduleName?.toLowerCase()] || "folder";
  };

  const resourceType = getResourceType(type);

  let Icon = Folder;
  if (resourceType === "activity") Icon = FileEdit;
  if (resourceType === "virtualclass") Icon = Headphones;
  if (resourceType === "forum") Icon = MessagesSquare;
  if (resourceType === "everythingelse") Icon = Bug;

  return (
    <div
      onClick={onClick}
      className={`
            ${getColorClasses(color)}
            p-4 sm:p-6 rounded-2xl flex items-center gap-4 cursor-pointer
            transition-transform hover:scale-[1.02] active:scale-[0.98]
        `}
    >
      <div className="opacity-50">
        <Icon size={24} />
      </div>
      <span className="font-medium text-stone-800 text-lg">{title}</span>
    </div>
  );
});

// Module Content Block Component
export const ModuleContentBlock = memo(() => (
  <div className="bg-[#F3EADD] p-8 rounded-[2rem] text-stone-800 leading-relaxed space-y-6 font-medium text-lg shadow-sm">
    <p>
      La importancia del arte en videojuegos. Niveles de arte. Aplicación del
      arte en videojuegos.
    </p>
    <p>
      Pixelación y vectorización. La importancia de los borradores. Línea.
      Formas simples. Luces y sombras.
    </p>
    <p>
      Figura humana: Proporciones del cuerpo, línea de acción y ejes de
      gravedad. Anatomía de animales. La importancia de la silueta.
    </p>
    <p>La importancia de las referencias</p>
  </div>
));

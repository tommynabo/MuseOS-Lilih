import React from 'react';
import { Linkedin } from 'lucide-react';

interface LinkedInPostLinkProps {
  url?: string;
  className?: string;
  showIcon?: boolean;
  showText?: boolean;
  text?: string;
  iconSize?: number;
  variant?: 'button' | 'link' | 'compact';
}

/**
 * LinkedInPostLink - Componente reutilizable para mostrar enlaces a posts de LinkedIn
 *
 * @param url - URL del post de LinkedIn (opcional, si no existe no renderiza nada)
 * @param className - Clases CSS adicionales para personalizar el estilo
 * @param showIcon - Mostrar el icono de LinkedIn (default: true)
 * @param showText - Mostrar el texto (default: true)
 * @param text - Texto personalizado (default: "Ver en LinkedIn")
 * @param iconSize - Tamaño del icono en pixels (default: 14)
 * @param variant - Variante de estilo: 'button' (botón circular), 'link' (enlace inline), 'compact' (badge pequeño)
 */
const LinkedInPostLink: React.FC<LinkedInPostLinkProps> = ({
  url,
  className = '',
  showIcon = true,
  showText = true,
  text = 'Ver en LinkedIn',
  iconSize = 14,
  variant = 'button'
}) => {
  // Si no hay URL, no renderizar nada
  if (!url) return null;

  // Prevenir propagación del click (útil cuando está dentro de un elemento clickeable como IdeaCard)
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.stopPropagation();
  };

  // Variantes de estilo
  const variantStyles = {
    button: 'w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-blue-600 hover:bg-blue-100 hover:text-blue-700 transition-all shadow-sm border border-blue-100',
    link: 'inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 hover:underline transition-colors',
    compact: 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 hover:text-blue-800 transition-all text-xs font-medium border border-blue-200'
  };

  // Para la variante 'button', solo mostrar icono
  if (variant === 'button') {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleClick}
        className={`${variantStyles.button} ${className}`}
        title={text}
        aria-label={text}
      >
        <Linkedin size={iconSize} />
      </a>
    );
  }

  // Para otras variantes, mostrar icono y/o texto según props
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      className={`${variantStyles[variant]} ${className}`}
      aria-label={text}
    >
      {showIcon && <Linkedin size={iconSize} />}
      {showText && <span>{text}</span>}
    </a>
  );
};

export default LinkedInPostLink;

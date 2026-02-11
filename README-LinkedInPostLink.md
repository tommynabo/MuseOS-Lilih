# LinkedInPostLink Component

Componente React reutilizable para mostrar enlaces a posts originales de LinkedIn con el logo oficial.

## 📋 Descripción

`LinkedInPostLink` es un componente modular diseñado para mostrar enlaces clickeables a posts de LinkedIn. Incluye el icono de LinkedIn y es totalmente personalizable mediante props.

## 🚀 Instalación

### Requisitos previos

- React 18+
- TypeScript (recomendado)
- Tailwind CSS
- `lucide-react` para los iconos

### Pasos de instalación

1. **Instalar dependencias** (si no las tienes):
   ```bash
   npm install lucide-react
   ```

2. **Copiar el archivo del componente**:
   - Copiar `LinkedInPostLink.tsx` a tu carpeta de componentes

3. **Verificar que Tailwind CSS esté configurado** en tu proyecto

## 💡 Uso

### Importación básica

```tsx
import LinkedInPostLink from './components/LinkedInPostLink';
```

### Ejemplos de uso

#### 1. Variante Button (Botón circular - solo icono)

```tsx
<LinkedInPostLink
  url="https://www.linkedin.com/posts/username_post-id"
  variant="button"
/>
```

**Resultado**: Botón circular pequeño con el icono de LinkedIn, ideal para esquinas o toolbars.

---

#### 2. Variante Compact (Badge con icono y texto)

```tsx
<LinkedInPostLink
  url="https://www.linkedin.com/posts/username_post-id"
  variant="compact"
  iconSize={16}
/>
```

**Resultado**: Badge rectangular con icono + texto "Ver en LinkedIn", ideal para destacar el enlace.

---

#### 3. Variante Link (Enlace inline)

```tsx
<LinkedInPostLink
  url="https://www.linkedin.com/posts/username_post-id"
  variant="link"
  text="Ver post original"
  iconSize={14}
/>
```

**Resultado**: Enlace de texto tradicional con icono, ideal para párrafos o listas.

---

#### 4. Personalización completa

```tsx
<LinkedInPostLink
  url={post.linkedinUrl}
  variant="compact"
  showIcon={true}
  showText={true}
  text="Ir a LinkedIn"
  iconSize={18}
  className="mt-4"
/>
```

---

#### 5. Dentro de un card clickeable

```tsx
<div onClick={handleCardClick} className="cursor-pointer">
  <h3>Mi Post</h3>
  <LinkedInPostLink
    url={post.url}
    variant="button"
  />
  {/* El click en el logo NO activará handleCardClick gracias a stopPropagation */}
</div>
```

---

## 📖 Props API

| Prop | Tipo | Default | Descripción |
|------|------|---------|-------------|
| `url` | `string \| undefined` | - | **Requerido**. URL del post de LinkedIn. Si no existe, el componente no se renderiza. |
| `variant` | `'button' \| 'link' \| 'compact'` | `'button'` | Estilo del componente. |
| `showIcon` | `boolean` | `true` | Mostrar el icono de LinkedIn. |
| `showText` | `boolean` | `true` | Mostrar el texto (no aplica en variant='button'). |
| `text` | `string` | `'Ver en LinkedIn'` | Texto personalizado del enlace. |
| `iconSize` | `number` | `14` | Tamaño del icono en pixels. |
| `className` | `string` | `''` | Clases CSS adicionales para personalización. |

---

## 🎨 Variantes visuales

### Button
- Botón circular pequeño (32x32px)
- Solo icono, sin texto
- Fondo gris claro, hover azul
- Ideal para: headers, esquinas de cards, toolbars

### Compact
- Badge rectangular con borde
- Icono + texto
- Fondo azul claro, hover azul más oscuro
- Ideal para: CTAs destacados, encabezados de secciones

### Link
- Enlace inline tradicional
- Icono + texto horizontal
- Sin fondo, solo color azul con underline en hover
- Ideal para: dentro de párrafos, listas, footers

---

## ⚙️ Características técnicas

✅ **Prevención de propagación de eventos**: El click en el componente no se propaga al padre (útil cuando está dentro de elementos clickeables).

✅ **Seguridad**: Usa `target="_blank"` y `rel="noopener noreferrer"` para prevenir vulnerabilidades.

✅ **Accesibilidad**: Incluye atributos `aria-label` y `title` para lectores de pantalla.

✅ **Renderizado condicional**: Si no hay URL, el componente no renderiza nada (evita errores).

✅ **TypeScript**: Completamente tipado con interfaces claras.

---

## 🔧 Personalización avanzada

### Cambiar los colores

Puedes sobreescribir los colores usando la prop `className`:

```tsx
<LinkedInPostLink
  url={url}
  variant="compact"
  className="!bg-purple-50 !text-purple-700 hover:!bg-purple-100"
/>
```

### Crear tu propia variante

Puedes extender el componente creando una nueva variante en el objeto `variantStyles` dentro de `LinkedInPostLink.tsx`.

---

## 📦 Ejemplo completo de integración

```tsx
import React from 'react';
import LinkedInPostLink from './components/LinkedInPostLink';

interface Post {
  id: string;
  title: string;
  linkedinUrl?: string;
}

const PostCard: React.FC<{ post: Post }> = ({ post }) => {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-start mb-4">
        <h2 className="text-xl font-bold">{post.title}</h2>
        <LinkedInPostLink
          url={post.linkedinUrl}
          variant="button"
        />
      </div>
      <p className="text-gray-600">Contenido del post...</p>
      <div className="mt-4">
        <LinkedInPostLink
          url={post.linkedinUrl}
          variant="compact"
          text="Ver análisis completo en LinkedIn"
        />
      </div>
    </div>
  );
};

export default PostCard;
```

---

## 🐛 Troubleshooting

### El icono no se muestra
- Verifica que `lucide-react` esté instalado: `npm list lucide-react`
- Verifica que la importación sea correcta

### Los estilos no se aplican
- Asegúrate de que Tailwind CSS esté configurado correctamente
- Verifica que tu `tailwind.config.js` incluya la ruta del componente

### El componente no se renderiza
- Verifica que la prop `url` tenga un valor válido
- El componente retorna `null` si `url` es `undefined` o vacío

---

## 📝 Licencia

Este componente es de código abierto y puede ser usado libremente en proyectos personales y comerciales.

---

## 🤝 Contribuciones

Si quieres mejorar este componente:
1. Añade nuevas variantes en `variantStyles`
2. Mejora la accesibilidad
3. Añade animaciones con Tailwind CSS
4. Comparte tus mejoras con la comunidad

---

## ✨ Créditos

Componente creado para MuseOS - Sistema de generación de contenido para LinkedIn.

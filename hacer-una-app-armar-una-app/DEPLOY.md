# Deploy de AhorroInteligente

## 1. Supabase

La app ya apunta a este proyecto:

```txt
https://dguwomfkyxwazjuvnvvi.supabase.co
```

Antes de publicar, confirmar:

1. En Supabase, abrir `SQL Editor`.
2. Ejecutar `supabase-schema.sql`.
3. En `Authentication > Providers > Email`, decidir si queres confirmar emails o no.

## 2. Vercel

Opcion recomendada:

1. Subir esta carpeta a un repositorio de GitHub.
2. Entrar a https://vercel.com/.
3. Crear `New Project`.
4. Importar el repositorio.
5. Framework preset: `Other`.
6. Build command: dejar vacio.
7. Output directory: dejar vacio o `.`.
8. Deploy.

Opcion manual:

1. Instalar Vercel CLI si lo tenes disponible.
2. Desde esta carpeta ejecutar:

```bash
vercel
```

## 3. Supabase Auth URLs

Cuando Vercel entregue el dominio, por ejemplo:

```txt
https://ahorrointeligente.vercel.app
```

Agregarlo en Supabase:

1. `Authentication > URL Configuration`
2. `Site URL`: pegar el dominio de Vercel.
3. `Redirect URLs`: agregar:

```txt
https://ahorrointeligente.vercel.app
```

Si Vercel crea otro dominio, usar exactamente ese.

## 4. Instalar en celular

Con la app publicada en HTTPS:

- Android/Chrome: menu > Instalar app o Agregar a pantalla principal.
- iPhone/Safari: compartir > Agregar a pantalla de inicio.

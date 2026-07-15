import { useEffect, useState } from "react"

import { Toaster } from "@/components/ui/toast"
import { AuthProvider } from "@/lib/auth"
import FreeForm from "@/pages/FreeForm"
import Gallery from "@/pages/Gallery"
import Mandala from "@/pages/Mandala"
import Mirror from "@/pages/Mirror"
import TemplateCreator from "@/pages/TemplateCreator"
import Tiles from "@/pages/Tiles"

function useHashRoute() {
  const [route, setRoute] = useState(
    () => window.location.hash.replace(/^#/, "") || "/"
  )

  useEffect(() => {
    const onChange = () =>
      setRoute(window.location.hash.replace(/^#/, "") || "/")
    window.addEventListener("hashchange", onChange)
    return () => window.removeEventListener("hashchange", onChange)
  }, [])

  return route
}

function Routes() {
  const route = useHashRoute()

  switch (route) {
    case "/free-form":
      return <FreeForm />
    case "/tiles":
      return <Tiles />
    case "/mirror":
      return <Mirror />
    case "/new-template":
      return <TemplateCreator />
    case "/gallery":
      return <Gallery />
    case "/mandala":
    default:
      // Mandala is the default landing experience (no separate home page).
      return <Mandala />
  }
}

function App() {
  return (
    <AuthProvider>
      <Routes />
      <Toaster />
    </AuthProvider>
  )
}

export default App

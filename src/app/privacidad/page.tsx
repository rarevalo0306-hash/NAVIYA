import type { Metadata } from "next";
import { LEGAL_CONTACT, LegalPage } from "@/components/legal-page";

export const metadata: Metadata = { title: "Política de privacidad" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Política de privacidad">
      <p>
        En Orbusiness (naviya.app) ayudamos a negocios pequeños a tener su marca, su página web, un CRM y a Nuna, una asistente con
        inteligencia artificial. Esta política explica qué datos usamos, para qué y cuáles son tus derechos.
      </p>

      <h2>Qué datos recogemos</h2>
      <ul>
        <li>Datos de tu cuenta: nombre, correo y, si entras con Google, Facebook o WhatsApp, tu nombre, correo, foto o número de teléfono.</li>
        <li>Datos de tu negocio que nos cuentas en la plática con Nuna: nombre, giro, ubicación, horario, productos, precios, formas de pago y cómo trabajas.</li>
        <li>Lo que dices por voz cuando usas «Conversar por voz»: el audio se convierte en texto para entender tu respuesta; guardamos el texto, no la grabación.</li>
        <li>Archivos que subes, como tu logo o fotos de tu negocio.</li>
        <li>Datos de los clientes de tu negocio que llegan por tu página web (por ejemplo, nombre, teléfono y lo que necesitan).</li>
        <li>Datos técnicos básicos para que el servicio funcione y sea seguro (por ejemplo, registros de acceso).</li>
      </ul>

      <h2>Para qué los usamos</h2>
      <ul>
        <li>Para armarte tu identidad de marca, tu página web y tu CRM con datos reales de tu negocio.</li>
        <li>Para que Nuna atienda y dé seguimiento a tus clientes en tu nombre, cuando lo actives.</li>
        <li>Para mantener tu cuenta segura, darte soporte y mejorar el servicio.</li>
      </ul>
      <p>No vendemos tus datos ni los de tus clientes.</p>

      <h2>Con quién los compartimos</h2>
      <p>
        Solo con proveedores que necesitamos para dar el servicio: alojamiento y base de datos, servicios de inteligencia artificial (para
        entender texto y voz y para diseñar), y los servicios de inicio de sesión que elijas (Google, Facebook o WhatsApp). Estos proveedores
        usan los datos solo para prestarnos su servicio. También podríamos compartirlos si la ley nos lo exige.
      </p>

      <h2>Cuánto tiempo los guardamos</h2>
      <p>Mientras tu cuenta esté activa. Si la cierras, borramos tus datos y los de tu negocio, salvo lo que la ley nos obligue a conservar.</p>

      <h2>Tus derechos</h2>
      <p>
        Puedes pedirnos ver, corregir o borrar tus datos, o cerrar tu cuenta, escribiéndonos a{" "}
        <a href={`mailto:${LEGAL_CONTACT}`} className="underline underline-offset-4">{LEGAL_CONTACT}</a>. Te respondemos en un plazo razonable.
      </p>

      <h2>Menores de edad</h2>
      <p>Orbusiness es para dueños de negocio mayores de edad. No recogemos a propósito datos de menores.</p>

      <h2>Cambios a esta política</h2>
      <p>Si la cambiamos, publicaremos la nueva versión aquí con su fecha. Si el cambio es importante, te avisaremos.</p>
    </LegalPage>
  );
}

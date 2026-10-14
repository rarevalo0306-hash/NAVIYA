import type { Metadata } from "next";
import { LEGAL_CONTACT, LegalPage } from "@/components/legal-page";

export const metadata: Metadata = { title: "Términos de servicio" };

export default function TermsPage() {
  return (
    <LegalPage title="Términos de servicio">
      <p>Al crear una cuenta o usar Orbusiness (naviya.app) aceptas estos términos. Si no estás de acuerdo, no uses el servicio.</p>

      <h2>El servicio</h2>
      <p>
        Orbusiness arma para negocios pequeños su identidad de marca, su página web, un CRM y a Nuna, una asistente con inteligencia
        artificial que atiende y da seguimiento a sus clientes. Algunas funciones pueden estar en prueba o cambiar con el tiempo.
      </p>

      <h2>Tu cuenta</h2>
      <ul>
        <li>Debes ser mayor de edad y dar datos verdaderos.</li>
        <li>Eres responsable de cuidar el acceso a tu cuenta y de lo que se haga con ella.</li>
        <li>Puedes cerrar tu cuenta cuando quieras.</li>
      </ul>

      <h2>Uso permitido</h2>
      <p>
        No puedes usar Orbusiness para actividades ilegales, para engañar o molestar a otras personas, para enviar mensajes no deseados ni para
        publicar contenido que no tengas derecho a usar.
      </p>

      <h2>Tu contenido y tu marca</h2>
      <p>
        Los datos, textos, fotos y logos de tu negocio son tuyos. Nos das permiso de usarlos solo para prestarte el servicio (por ejemplo, para
        mostrar tu página web). Los archivos del kit de marca que compres son para el uso de tu negocio.
      </p>

      <h2>Inteligencia artificial</h2>
      <p>
        Nuna y las herramientas de diseño usan inteligencia artificial. Pueden equivocarse: revisa la información importante (precios,
        direcciones, cotizaciones) antes de usarla. Tú decides qué publicar y qué enviar a tus clientes.
      </p>

      <h2>Pagos</h2>
      <p>Si un servicio tiene costo, te mostraremos el precio antes de cobrarte. Los detalles de cada plan se indican al contratarlo.</p>

      <h2>Responsabilidad</h2>
      <p>
        Hacemos nuestro mejor esfuerzo para que el servicio funcione bien y sin interrupciones, pero no podemos garantizarlo siempre. En la
        medida que la ley lo permita, no somos responsables por pérdidas indirectas derivadas del uso del servicio.
      </p>

      <h2>Cambios y contacto</h2>
      <p>
        Podemos actualizar estos términos; publicaremos la nueva versión aquí con su fecha. Para cualquier duda, escríbenos a{" "}
        <a href={`mailto:${LEGAL_CONTACT}`} className="underline underline-offset-4">{LEGAL_CONTACT}</a>.
      </p>
    </LegalPage>
  );
}

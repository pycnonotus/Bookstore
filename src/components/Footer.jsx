export default function Footer() {
    return <footer className="bg-spruce-deep text-paper">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:grid-cols-2 sm:px-6 lg:grid-cols-3 lg:px-8">
            <section id="contact" className="min-w-0"><h2 className="font-semibold">Contact us</h2>
                <address className="mt-3 text-sm not-italic">42 Answer Street, Universe</address>
                <a className="mt-2 inline-block break-all text-sm underline"
                   href="mailto:Totaly@real.mail">Totaly@real.mail</a></section>
            <section><h2 className="font-semibold">Opening hours</h2><p className="mt-3 text-sm">Sunday–Tuesday ·
                10am–6pm</p><p className="mt-2 text-sm text-paper/75">Friday & Saturday · Closed</p></section>
        </div>
    </footer>;
}

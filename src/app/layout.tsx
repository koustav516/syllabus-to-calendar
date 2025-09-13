export const metadata = {
    title: "Syllabus to Calendar",
    description: "Upload syllabus and convert to calendar events",
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en">
            <body>{children}</body>
        </html>
    );
}

type MarkdownContentProps = {
  html: string;
};

export default function MarkdownContent(props: MarkdownContentProps) {
  return <div class="markdown" innerHTML={props.html} />;
}

// Deterministic source snippets shared by pure and native-conversion regressions.
export const python = "values = [\n    n < 3 and n >= 0,\n]\nprint(values[0])\n";
export const pythonHtml =
  '<div class="highlight-python notranslate"><div class="highlight"><pre><span></span><span class="n">values</span> = [\n    <span class="n">n</span> &lt; 3 and n &gt;= 0,\n]\nprint(values[0])\n</pre></div></div>';
export const jsx =
  "export function App() {\n  return <button onClick={() => setN(n + 1)}>Next & more</button>;\n}";
export const jsxHtml =
  '<pre><code class="language-jsx"><span class="line">export function App() {</span><span class="line">  return &lt;button onClick={() =&gt; setN(n + 1)}&gt;Next &amp; more&lt;/button&gt;;</span><span class="line">}</span></code></pre>';

export const reactCodeMirror = "function MyButton() {\n  return (\n    <button>I'm a button</button>\n  );\n}\n";
export const reactCodeMirrorHtml =
  '<pre class="sp-cm sp-pristine sp-javascript flex align-start"><code class="sp-pre-placeholder grow-[2]">' +
  '<div class="cm-line "><span class="sp-syntax-keyword">function</span> <span class="sp-syntax-definition">MyButton</span><span class="sp-syntax-punctuation">(</span><span class="sp-syntax-punctuation">)</span> <span class="sp-syntax-punctuation">{</span><br></div>' +
  '<div class="cm-line ">  <span class="sp-syntax-keyword">return</span> <span class="sp-syntax-punctuation">(</span><br></div>' +
  '<div class="cm-line ">    &lt;button&gt;I\'m a button&lt;/button&gt;<br></div>' +
  '<div class="cm-line ">  );<br></div><div class="cm-line ">}<br></div></code></pre>';

Query the Code Wiki with a natural language question.

Argument: $ARGUMENTS (the question to ask)

Steps:
1. Parse the user's question from $ARGUMENTS
2. Call `wiki_query({ question: "<question>" })` to get analysis data
3. Use the returned analysis data to answer the question with file:line references
4. If the answer requires specific module context, also call `wiki_module({ module_path: "<module>" })`

The wiki_query tool returns raw analysis data (exports, types, imports, dependencies).
You synthesize this into a grounded answer with specific file references.

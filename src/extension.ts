import * as vscode from 'vscode'; 

interface InlineLinkQuickPickItem extends vscode.QuickPickItem {
    kind: 'inline-link';
    link: string;
}

interface ReferenceStyleQuickPickItem extends vscode.QuickPickItem {
    kind: 'reference-style';
    referenceLabel: string;
}

type MyQuickPickItem = InlineLinkQuickPickItem | ReferenceStyleQuickPickItem;

export function activate(context: vscode.ExtensionContext) {

	console.log('Congratulations, your extension "vscode-GetXrefLink" is now active!'); 

	var disposable = vscode.commands.registerCommand('markdown.links', () => {

            var editor = vscode.window.activeTextEditor
        
            var selection = editor.selection;
            var sls = selection.start;
            var sle = selection.end; 
        
            var selectedText = editor.document.getText(selection);
        
            var text = vscode.window.activeTextEditor.document.getText();
        
            function inlineLinks() {
                var pattern = '\\[(.*)\\]\\((.*)\\)';        
                var r = new RegExp(pattern, 'gm');

                var result;
                var items: InlineLinkQuickPickItem[] = [];
                while ( (result = r.exec(text)) ) {
                    var tag=result[1];
                    if(tag.length === 0) {
                        tag="image";                                
                    }
                            
                    items.push({ label: tag, description: result[2], kind: 'inline-link', link: result[2] }); 
                }

                return items;
            }

            function referenceStyleLinks() {
                var pattern = '\\[(.*)\\]:(.*)\s*$';        
                var r = new RegExp(pattern, 'gm');

                var result;
                var items: ReferenceStyleQuickPickItem[] = [];
                while ( (result = r.exec(text)) ) {
                    var tag=result[1];
                    if(tag.length === 0) {
                        tag="image";                                
                    }
                            
                    items.push({ label: tag, description: result[2], kind: 'reference-style', referenceLabel: result[1] }); 
                }
                return items;
            }

            var items: MyQuickPickItem[] = [...referenceStyleLinks(), ...inlineLinks()];
               
        
            vscode.window.showQuickPick(items).then((qpSelection) => {
                var range = new vscode.Range(sls.line, sls.character, sle.line, sle.character);
                var result;

                if (qpSelection.kind === 'inline-link') {
                    if (!qpSelection) {
                        result='['+selectedText+']()';                
                    } else {
                        result = '['+selectedText+']('+qpSelection.link+')';
                    }
                } else if (qpSelection.kind === 'reference-style') {
                    if (!qpSelection) {
                        result='['+selectedText+']()';                
                    } else {
                        result = '['+selectedText+']['+qpSelection.referenceLabel+ ']';
                    }
                }

                
                       
                editor.edit((editBuilder) => {
                    editBuilder.replace(range, result);                
		});
            });		
	});
    	
	context.subscriptions.push(disposable);
}

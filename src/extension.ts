import * as vscode from 'vscode'; 

export function activate(context: vscode.ExtensionContext) {

	console.log('Congratulations, your extension "vscode-GetXrefLink" is now active!'); 

	var disposable = vscode.commands.registerCommand('markdown.links', () => {

        let items: vscode.QuickPickItem[] = [];         

        var editor = vscode.window.activeTextEditor
        
        var selection = editor.selection;
        var sls = selection.start;
        var sle = selection.end; 
        
        var selectedText = editor.document.getText(selection);
        
        var text = vscode.window.activeTextEditor.document.getText();
        
        var pattern = '\\[(.*)\\]\\((.*)\\)';        
        var r = new RegExp(pattern, 'gm');

        var result;
        while ( (result = r.exec(text)) ) {            
            var tag=result[1];
            if(tag.length === 0) {
                tag="image";                                
            }
                        
            items.push({ label: tag, description: result[2] }); 
        }   
        
        vscode.window.showQuickPick(items).then((qpSelection) => {
            var range = new vscode.Range(sls.line, sls.character, sle.line, sle.character);
            var result;

            if (!qpSelection) {
                result='['+selectedText+']()';                
            } else {
                result = '['+selectedText+']('+qpSelection.description+')';
            }
                       
            editor.edit((editBuilder) => {				
				editBuilder.replace(range, result);                
			});
        });		
	});
    	
	context.subscriptions.push(disposable);
}
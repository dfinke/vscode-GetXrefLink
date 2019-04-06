import * as vscode from 'vscode'; 

interface InlineLinkQuickPickItem extends vscode.QuickPickItem {
    kind: 'inline-link';
    link: string;
}

interface ReferenceStyleQuickPickItem extends vscode.QuickPickItem {
    kind: 'reference-style';
    referenceLabel: string;
}

interface ReferenceInfos {
    [label: string]: ReferenceInfo
}

interface UniqueReferenceDefinition { 
    label: string; 
    url: string;
    position: vscode.Position;
 };
type ReferenceDefinition = UniqueReferenceDefinition | 'multiple-definitions';
interface ReferenceDefinitions {
    [label: string]: ReferenceDefinition
}

interface ReferenceInfo {
    usageCount: number;
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
        
            function getReferenceDefinitions(): ReferenceDefinitions {
                var result: ReferenceDefinitions = {}
                var pattern = '\\[(.*)\\]:(.*)\s*$';        
                var r = new RegExp(pattern, 'gm');

                var match: RegExpExecArray;
                var items: ReferenceStyleQuickPickItem[] = [];

                while ( (match = r.exec(text)) ) {
                    var label = match[1];
                    var sourceOffset = match.index;
                    var position = editor.document.positionAt(sourceOffset);
                    if (result.hasOwnProperty(label)) {
                        result[label] = "multiple-definitions";
                    } else {
                        result[label] = {
                            label: label,
                            url: match[2],
                            position: position,
                        }
                    }
                }
                return result;
            }

            var referenceDefinitions = getReferenceDefinitions();
            console.log(`Reference definitions`, referenceDefinitions);

            function getDefinition(label: string): ReferenceDefinition | undefined {
                if (referenceDefinitions.hasOwnProperty(label)) {
                    return referenceDefinitions[label];
                } else {
                    return undefined;
                }
            }

            function isDefinedInMultiplePlaces(arg: ReferenceDefinition | undefined): arg is 'multiple-definitions' {
                if (arg === undefined) {
                    return false;
                }
                return arg === 'multiple-definitions';
            }

            function isUniqueDefinition(arg: ReferenceDefinition | undefined): arg is UniqueReferenceDefinition {
                if (arg === undefined) {
                    return false;
                }
                return arg !== 'multiple-definitions';
            }

            function getReferenceUsagesByCountAscending(): ReferenceInfos {
                var pattern = '\\[.*?\\]\\[([^\\]]+)\\]';
                var r = new RegExp(pattern, 'gm');

                var match: RegExpExecArray;
                var result: ReferenceInfos = {};
                
                while ( (match = r.exec(text)) ) {
                    var label = match[1];
                    if (!result.hasOwnProperty(label)) {
                        result[label] = {
                            usageCount: 1,
                        };
                    } else {
                        result[label].usageCount++;
                    }
                }
                console.info(`Computed usages by label count: `, result);
                return result;
            }

            function hasMultipleDefinitions(label: string) {
                return referenceDefinitions.hasOwnProperty(label) && referenceDefinitions[label] === 'multiple-definitions';
            }

            function inlineLinks() {
                var pattern = '\\[(.*)\\]\\((.*)\\)';        
                var r = new RegExp(pattern, 'gm');

                var result;
                var items: InlineLinkQuickPickItem[] = [];
                var seenUrls = new Set();
                while ( (result = r.exec(text)) ) {
                    var tag=result[1];
                    if(tag.length === 0) {
                        tag="image";                                
                    }
                    var link = result[2];
                    if (!seenUrls.has(link)) {
                        seenUrls.add(link);
                        items.push({ label: tag, description: link, kind: 'inline-link', link: link }); 
                    }
                }

                return items;
            }

            function referenceStyleLinks() {
                var usageCounter = getReferenceUsagesByCountAscending()

                function getUsageCount(item: string | ReferenceStyleQuickPickItem): number {
                    var label: string;
                    if (typeof item === "string") {
                        label = item;
                    } else {
                        label = item.referenceLabel;
                    }

                    if (usageCounter.hasOwnProperty(label)) {
                        var result = usageCounter[label].usageCount;
                        console.log(`  getUsageCount: ${label} is ${result}`)
                        return result;
                    }

                    return 0;
                }

                var items: ReferenceStyleQuickPickItem[] = [];

                var label: string;
                for (label in referenceDefinitions) {
                    var definition = referenceDefinitions[label];

                    if (label.length === 0) {
                        label="image";                                
                    }
                    var usageCount = getUsageCount(label);
                    var sharedProps = {
                        kind: 'reference-style' as 'reference-style',
                        referenceLabel: label,
                    };
                    
                    if (isDefinedInMultiplePlaces(definition)) {
                        items.push({
                            label: label,
                            description: 'Multiple definitions',
                            ...sharedProps
                        })
                    }
                    else if (usageCount >= 1) {
                        var usages = usageCount > 1 ? "usages" : "usage";
                        items.push({ 
                            label: label, 
                            description: ` (${usageCount} ${usages})`, 
                            detail: definition.url, 
                            ...sharedProps
                        });
                    } else {
                        items.push({ 
                            label: label, 
                            description: '(Unused)', 
                            detail: definition.url, 
                            ...sharedProps,
                        });
                    }
                    
                }

                function compare(a: ReferenceStyleQuickPickItem, b: ReferenceStyleQuickPickItem): number {
                    const defA = getDefinition(a.referenceLabel);
                    const defB = getDefinition(b.referenceLabel);
                    function closestByPosition<T>(referencePosition: vscode.Position, a: T, b: T, getPos: (t: T) => vscode.Position): T {
                        var posA = getPos(a);
                        var posB = getPos(b);
                        var lineDistanceA = Math.abs(posA.line - referencePosition.line);
                        var lineDistanceB = Math.abs(posB.line - referencePosition.line);

                        if (lineDistanceA < lineDistanceB) {
                            return a;
                        } else if (lineDistanceB < lineDistanceA) {
                            return b;
                        } else {
                            // default to `a` if both are the same distance from reference position
                            return a;
                        }
                    }
                    
                    console.log(`Comparing ${a.referenceLabel} against ${b.referenceLabel}`);
                    if (getUsageCount(a) == 0 && getUsageCount(b) >= 1) {
                        // Only a is unused, rank a higher
                        console.debug(`a is unused, b is not, rank a higher`);
                        return -1;
                    } else if (getUsageCount(b) == 0 && getUsageCount(a) >= 1) {
                        // Only b is unused, rank b higher
                        console.debug(`b is unused, a is not, rank b higher`);
                        return 1;
                    }
                    else  {
                        // both have more than one usage

                        // 1. Prefer closest unique definition, if both are unique
                        // 2. Prefer unique definition over multiple definitions
                        // 3. if both are defined in multiple places, use alphabetical order
                        if (isUniqueDefinition(defA) && isUniqueDefinition(defB)) {
                            var closest = closestByPosition(sls, defA, defB, def => def.position);
                            return closest === defA ? -1 : 1;
                        }
                        if (isUniqueDefinition(defA) && isDefinedInMultiplePlaces(defB)) {
                            return -1;
                        }
                        if (isUniqueDefinition(defB) && isDefinedInMultiplePlaces(defA)) {
                            return 1;
                        }
                        if (isDefinedInMultiplePlaces(defA) && isDefinedInMultiplePlaces(defB)) {
                            return a.label.localeCompare(b.label);
                        }
                        
                        console.error("Unhandled case when comparing a and b");
                        console.error("a", a);
                        console.error("b", b);
                        console.error("defA", defA);
                        console.error("defB", defB);
                        throw new Error("Unhandled case");
                    }
                }
                
                items.sort(compare);

                return items;
            }

            // always prefer reference style links over inline links
            var items: MyQuickPickItem[] = [...referenceStyleLinks(), ...inlineLinks()];
               
        
            vscode.window.showQuickPick(items, {matchOnDetail: true}).then((qpSelection) => {
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

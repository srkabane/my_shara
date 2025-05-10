import { ColorSwatch, Group } from '@mantine/core';
import { Button } from '@/components/ui/button';
import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import Draggable from 'react-draggable';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';
import { SWATCHES } from '@/constants';
import { Eraser, FileUp, Mic, MicOff, Save } from 'lucide-react';

interface GeneratedResult {
    expression: string;
    answer: string;
}

interface Response {
    expr: string;
    result: string;
    assign: boolean;
}

export default function Home() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [color, setColor] = useState('rgb(255, 255, 255)');
    const [reset, setReset] = useState(false);
    const [dictOfVars, setDictOfVars] = useState({});
    const [result, setResult] = useState<GeneratedResult>();
    const [latexPosition, setLatexPosition] = useState({ x: 10, y: 200 });
    const [latexExpression, setLatexExpression] = useState<Array<string>>([]);
    const [isEraser, setIsEraser] = useState(false);
    const [lineWidth, setLineWidth] = useState(3);
    const isDrawingRef = useRef(false);
    const lastPosRef = useRef<{ x: number; y: number } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const {
        transcript,
        listening,
        resetTranscript,
        browserSupportsSpeechRecognition
    } = useSpeechRecognition();

    useEffect(() => {
        if (transcript) {
            processVoiceCommand(transcript);
            resetTranscript();
        }
    }, [transcript]);

    const processVoiceCommand = async (command: string) => {
        const lowerCommand = command.toLowerCase();
        if (lowerCommand.includes('calculate')) {
            await runRoute();
        } else if (lowerCommand.includes('reset')) {
            setReset(true);
        } else if (lowerCommand.includes('eraser')) {
            toggleEraser();
        } else if (lowerCommand.includes('save')) {
            saveCanvas();
        }
    };

    const toggleMicrophone = () => {
        if (listening) {
            SpeechRecognition.stopListening();
        } else {
            SpeechRecognition.startListening({ continuous: true });
        }
    };

    const toggleEraser = () => {
        setIsEraser(!isEraser);
        setLineWidth(isEraser ? 3 : 20);
    };

    useEffect(() => {
        if (latexExpression.length > 0 && window.MathJax) {
            setTimeout(() => {
                window.MathJax.Hub.Queue(["Typeset", window.MathJax.Hub]);
            }, 0);
        }
    }, [latexExpression]);

    useEffect(() => {
        if (result) {
            renderLatexToCanvas(result.expression, result.answer);
        }
    }, [result]);

    useEffect(() => {
        if (reset) {
            resetCanvas();
            setLatexExpression([]);
            setResult(undefined);
            setDictOfVars({});
            setReset(false);
        }
    }, [reset]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (ctx) {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            ctx.lineCap = 'round';
            ctx.strokeStyle = 'white';
            ctx.lineWidth = lineWidth;
            ctx.fillStyle = 'black';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        const handleResize = () => {
            if (canvas && ctx) {
                canvas.width = window.innerWidth;
                canvas.height = window.innerHeight;
                ctx.lineCap = 'round';
                ctx.strokeStyle = color;
                ctx.lineWidth = lineWidth;
                ctx.fillStyle = 'black';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }
        };

        window.addEventListener('resize', handleResize);
        canvas.addEventListener('pointerdown', handlePointerDown);
        canvas.addEventListener('pointermove', handlePointerMove);
        canvas.addEventListener('pointerup', handlePointerUp);
        canvas.addEventListener('pointerleave', handlePointerUp);

        return () => {
            window.removeEventListener('resize', handleResize);
            canvas.removeEventListener('pointerdown', handlePointerDown);
            canvas.removeEventListener('pointermove', handlePointerMove);
            canvas.removeEventListener('pointerup', handlePointerUp);
            canvas.removeEventListener('pointerleave', handlePointerUp);
        };
    }, [lineWidth, color]);

    const renderLatexToCanvas = (expression: string, answer: string) => {
        const latex = `\\(\\LARGE{${expression} = ${answer}}\\)`;
        setLatexExpression([...latexExpression, latex]);
    };

    const resetCanvas = () => {
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = 'black';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }
        }
    };

    const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.beginPath();
                ctx.moveTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
                setIsDrawing(true);
            }
        }
    };

    const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!isDrawing) return;
        
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.strokeStyle = isEraser ? 'black' : color;
                ctx.lineWidth = lineWidth;
                ctx.lineTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
                ctx.stroke();
            }
        }
    };

    const handlePointerDown = (e: PointerEvent) => {
        if (e.pointerType !== 'pen' && e.pointerType !== 'mouse') return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.strokeStyle = isEraser ? 'black' : color;
        ctx.lineWidth = lineWidth;

        lastPosRef.current = { x, y };
        isDrawingRef.current = true;
    };

    const handlePointerMove = (e: PointerEvent) => {
        if (!isDrawingRef.current || (e.pointerType !== 'pen' && e.pointerType !== 'mouse')) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        ctx.strokeStyle = isEraser ? 'black' : color;
        const pressure = e.pressure || 1;
        ctx.lineWidth = isEraser ? 20 : (pressure * 4);
        ctx.lineTo(x, y);
        ctx.stroke();

        lastPosRef.current = { x, y };
    };

    const handlePointerUp = () => {
        isDrawingRef.current = false;
        lastPosRef.current = null;
    };

    const stopDrawing = () => {
        setIsDrawing(false);
    };

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = canvasRef.current;
                    if (canvas) {
                        const ctx = canvas.getContext('2d');
                        if (ctx) {
                            // Preserve aspect ratio while fitting the image
                            const scale = Math.min(
                                canvas.width / img.width,
                                canvas.height / img.height
                            );
                            const x = (canvas.width - img.width * scale) / 2;
                            const y = (canvas.height - img.height * scale) / 2;

                            ctx.fillStyle = 'black';
                            ctx.fillRect(0, 0, canvas.width, canvas.height);
                            ctx.drawImage(
                                img,
                                x,
                                y,
                                img.width * scale,
                                img.height * scale
                            );
                        }
                    }
                };
                img.src = e.target?.result as string;
            };
            reader.readAsDataURL(file);
        }
    };

    const saveCanvas = () => {
        const canvas = canvasRef.current;
        if (canvas) {
            const link = document.createElement('a');
            link.download = 'math-drawing.png';
            link.href = canvas.toDataURL();
            link.click();
        }
    };

    const runRoute = async () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        try {
            const response = await axios({
                method: 'post',
                url: `${import.meta.env.VITE_API_URL}/calculate`,
                data: {
                    image: canvas.toDataURL('image/png'),
                    dict_of_vars: dictOfVars
                }
            });

            const resp = await response.data;
            resp.data.forEach((data: Response) => {
                if (data.assign === true) {
                    setDictOfVars(prev => ({
                        ...prev,
                        [data.expr]: data.result
                    }));
                }
            });

            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            let minX = canvas.width, minY = canvas.height, maxX = 0, maxY = 0;

            for (let y = 0; y < canvas.height; y++) {
                for (let x = 0; x < canvas.width; x++) {
                    const i = (y * canvas.width + x) * 4;
                    if (imageData.data[i + 3] > 0) {
                        minX = Math.min(minX, x);
                        minY = Math.min(minY, y);
                        maxX = Math.max(maxX, x);
                        maxY = Math.max(maxY, y);
                    }
                }
            }

            const centerX = (minX + maxX) / 2;
            const centerY = (minY + maxY) / 2;

            setLatexPosition({ x: centerX, y: centerY });
            resp.data.forEach((data: Response) => {
                setTimeout(() => {
                    setResult({
                        expression: data.expr,
                        answer: data.result
                    });
                }, 1000);
            });
        } catch (error) {
            console.error('Error processing image:', error);
        }
    };

    if (!browserSupportsSpeechRecognition) {
        return <span>Browser doesn't support speech recognition.</span>;
    }

    return (
        <>
            <div className='grid grid-cols-3 gap-2 p-4'>
                <div className='flex gap-2'>
                    <Button
                        onClick={() => setReset(true)}
                        className='z-20 bg-black text-white hover:bg-gray-800'
                        variant='default'
                    >
                        Reset
                    </Button>
                    <Button
                        onClick={toggleEraser}
                        className={`z-20 ${isEraser ? 'bg-blue-500 hover:bg-blue-600' : 'bg-black hover:bg-gray-800'} text-white`}
                        variant='default'
                    >
                        <Eraser className="h-4 w-4" />
                    </Button>
                    <Button
                        onClick={() => fileInputRef.current?.click()}
                        className='z-20 bg-black text-white hover:bg-gray-800'
                        variant='default'
                    >
                        <FileUp className="h-4 w-4" />
                    </Button>
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        accept="image/*"
                        className="hidden"
                    />
                    <Button
                        onClick={saveCanvas}
                        className='z-20 bg-black text-white hover:bg-gray-800'
                        variant='default'
                    >
                        <Save className="h-4 w-4" />
                    </Button>
                </div>
                <Group className='z-20 justify-center'>
                    {SWATCHES.map((swatch) => (
                        <ColorSwatch
                            key={swatch}
                            color={swatch}
                            onClick={() => {
                                setColor(swatch);
                                setIsEraser(false);
                                setLineWidth(3);
                            }}
                            className="cursor-pointer hover:scale-110 transition-transform"
                            style={{
                                border: color === swatch ? '2px solid white' : 'none'
                            }}
                        />
                    ))}
                </Group>
                <div className='flex gap-2 justify-end'>
                    <Button
                        onClick={toggleMicrophone}
                        className={`z-20 ${listening ? 'bg-red-500 hover:bg-red-600' : 'bg-black hover:bg-gray-800'} text-white`}
                        variant='default'
                    >
                        {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                    </Button>
                    <Button
                        onClick={runRoute}
                        className='z-20 bg-black text-white hover:bg-gray-800'
                        variant='default'
                    >
                        Run
                    </Button>
                </div>
            </div>
            <canvas
                ref={canvasRef}
                id='canvas'
                className="absolute top-0 left-0 w-full h-full touch-none"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseOut={stopDrawing}
            />

            {latexExpression && latexExpression.map((latex, index) => (
                <Draggable
                    key={index}
                    defaultPosition={latexPosition}
                    onStop={(_e, data) => setLatexPosition({ x: data.x, y: data.y })}
                >
                    <div className="absolute p-2 text-white rounded shadow-md">
                        <div className="latex-content">{latex}</div>
                    </div>
                </Draggable>
            ))}
        </>
    );
}
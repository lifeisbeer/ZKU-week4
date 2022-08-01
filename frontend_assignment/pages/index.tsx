import detectEthereumProvider from "@metamask/detect-provider"
import { Strategy, ZkIdentity } from "@zk-kit/identity"
import { generateMerkleProof, Semaphore } from "@zk-kit/protocols"
import { providers } from "ethers"
import Head from "next/head"
import React from "react"
import styles from "../styles/Home.module.css"
import { Typography, TextField, Button, Container, Box } from "@mui/material"
import { useForm, Controller } from 'react-hook-form';
import Greeter from "artifacts/contracts/Greeters.sol/Greeters.json"
import { Contract, utils } from "ethers"
import * as yup from 'yup'

export default function Home() {
    const [logs, setLogs] = React.useState("Connect your wallet and greet!")
    const [msg, setMsg] = React.useState("No greeting yet")

    const provider = new providers.JsonRpcProvider("http://localhost:8545")
    const contract = new Contract("0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512", Greeter.abi, provider)
    contract.on("NewGreeting", (greeting) => {
        setMsg(utils.parseBytes32String(greeting));
    });

    async function greet() {
        setLogs("Creating your Semaphore identity...")

        const provider = (await detectEthereumProvider()) as any

        await provider.request({ method: "eth_requestAccounts" })

        const ethersProvider = new providers.Web3Provider(provider)
        const signer = ethersProvider.getSigner()
        const message = await signer.signMessage("Sign this message to create your identity!")

        const identity = new ZkIdentity(Strategy.MESSAGE, message)
        const identityCommitment = identity.genIdentityCommitment()
        const identityCommitments = await (await fetch("./identityCommitments.json")).json()

        const merkleProof = generateMerkleProof(20, BigInt(0), identityCommitments, identityCommitment)

        setLogs("Creating your Semaphore proof...")

        const greeting = "Hello world"

        const witness = Semaphore.genWitness(
            identity.getTrapdoor(),
            identity.getNullifier(),
            merkleProof,
            merkleProof.root,
            greeting
        )

        const { proof, publicSignals } = await Semaphore.genProof(witness, "./semaphore.wasm", "./semaphore_final.zkey")
        const solidityProof = Semaphore.packToSolidityProof(proof)

        const response = await fetch("/api/greet", {
            method: "POST",
            body: JSON.stringify({
                greeting,
                nullifierHash: publicSignals.nullifierHash,
                solidityProof: solidityProof
            })
        })

        if (response.status === 500) {
            const errorMessage = await response.text()

            setLogs(errorMessage)
        } else {
            setLogs("Your anonymous greeting is onchain :)")
        }
    }

    // references: 
    // https://mui.com/material-ui/getting-started/overview/
    // https://react-hook-form.com/get-started
    // https://levelup.gitconnected.com/using-react-hook-form-with-material-ui-components-ba42ace9507a
    // https://github.com/jquense/yup/tree/pre-v1
        
    const { handleSubmit, control } = useForm();

    const onSubmit = data => {

        let schema = yup.object().shape({
            name: yup.string("Name must be a string").required("Name can't be empty"),
            age: yup.number("Age must be a number").required("Age can't be empty").positive("Age must be positive").integer("Age must be integer"),
            address: yup.string("Address must be a string").required("Address can't be empty").test("is-address", "Address must be a valid Ethereum address", (value) => {
                return utils.isAddress(value)
            })
        });

        schema.validate( data ).then(function (valid) {
            console.log(JSON.stringify(data));
        }).catch(function (err) {
            console.log(err);
        });        
    };

    return (
        <div className={styles.container}>
            <Head>
                <title>Greetings</title>
                <meta name="description" content="A simple Next.js/Hardhat privacy application with Semaphore." />
                <link rel="icon" href="/favicon.ico" />
            </Head>

            <main className={styles.main}>
                <h1 className={styles.title}>Greetings</h1>

                <Container maxWidth="md" align="center">
        
                    <div>
                        <Typography sx={{ m: 5 }} variant="h4" align="center">
                            Please fill out this form:
                        </Typography>
                    </div>
                
                    <form onSubmit={handleSubmit(onSubmit)}>
                        <Controller
                            name="name"
                            control={control}
                            defaultValue=""
                            render={({ field: { onChange, value }, fieldState: { error } }) => (
                                <TextField
                                    required
                                    id="name"
                                    label="Name"
                                    variant="filled"
                                    value={value}
                                    onChange={onChange}
                                    error={!!error}
                                    helperText="Please enter your name"
                                    InputLabelProps={{
                                        shrink: true,
                                    }}
                                />
                            )}
                            rules={{ required: 'Name required' }}
                        />
                        <Controller
                            name="age"
                            control={control}
                            defaultValue=""
                            render={({ field: { onChange, value }, fieldState: { error } }) => (
                                <TextField
                                    required
                                    id="age"
                                    label="Age"
                                    type="number"
                                    variant="filled"
                                    value={value}
                                    onChange={onChange}
                                    error={!!error}
                                    helperText="Please enter your age"
                                    InputLabelProps={{
                                        shrink: true,
                                    }}
                                />
                            )}
                            rules={{ required: 'Email required' }}
                        />
                        <Controller
                            name="address"
                            control={control}
                            defaultValue=""
                            render={({ field: { onChange, value }, fieldState: { error } }) => (
                                <TextField
                                    required
                                    id="address"
                                    label="Address"
                                    variant="filled"
                                    value={value}
                                    onChange={onChange}
                                    error={!!error}
                                    helperText="Please enter your address"
                                    InputLabelProps={{
                                        shrink: true,
                                    }}
                                />
                            )}
                            rules={{ required: 'Password required' }}
                        />
                        <div>
                            <Button type="submit" sx={{ mt: 5 }} fullWidth variant="contained">Submit</Button>
                        </div>
                    </form>
                
                
                    <Typography display="block" sx={{ mt: 10 }} variant="h4" align="center">
                        Send an anonymous greeting using semaphore:
                    </Typography>

                    <div className={styles.logs}>{logs}</div>

                    <div>
                        <Button fullWidth variant="contained" onClick={() => greet()}>Greet</Button>
                    </div>

                    <Box component="div" sx={{ mt: 3, whiteSpace: 'normal' }}>
                        <Typography display="block" variant="h5" align="center">
                            Latest greeting: {msg}
                        </Typography>
                    </Box>

                    <Typography display="block"  variant="h4" align="center">
                        
                    </Typography>
                </Container>
            </main>
        </div>
    );
}

import axios from 'axios'

export interface ChangePasswordRequest {
    userID: string
    password: string
    newpassword: string
}

export interface ChangePasswordResponse {
    modified_count: number
}

export async function changePassword(
    params: ChangePasswordRequest
): Promise<ChangePasswordResponse> {
    const response = await fetch('/api/postpassword', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(params),
    })

    if (!response.ok) {
        throw new Error(`パスワード変更APIエラー: ${response.status}`)
    }

    const data = (await response.json()) as ChangePasswordResponse
    return data
}

export type SessionCheckResponse = {
    session: string
}

export type LoginRequest = {
    username: string
    password: string
}

export type LoginResponse = {
    code: number
    result: string
    expire: string
    msg: string
}

export async function login(req: LoginRequest): Promise<LoginResponse> {
    const { data } = await axios.post('/api/login', req, {
        withCredentials: true,
    })
    return data
}

export async function sessionCheck(): Promise<SessionCheckResponse> {
    const { data } = await axios.get('/api/sessioncheck', {
        withCredentials: true,
    })
    return data
}

